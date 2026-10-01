// Package keys serves the keys-only list endpoint, at
// POST /apis/{group}/{version}/{resource}/list-keys.
//
// It reads identities out of unified storage without fetching object bodies, so a
// controller can take a state-of-the-world snapshot cheaply. Served namespaced,
// and cluster-wide for the service identity.
//
// POST rather than GET because GET would permanently shadow an object of that
// name, and nothing is registered for POST on {resource}/{name}.
package keys

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"reflect"
	"slices"
	"strconv"
	"strings"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

// ListOptions is small, so anything larger is a client bug or an attack.
const maxRequestBody = 1 << 20 // 1 MiB

// kindRef identifies the kind a route serves. Only group and resource reach the
// storage key (which is group/resource/namespace/name); version serves the trace
// attribute and the per-version operation ID.
type kindRef struct {
	group    string
	version  string
	resource string
}

type Handler struct {
	store  resourcepb.ResourceStoreClient
	tracer trace.Tracer
	log    log.Logger
}

func NewHandler(store resourcepb.ResourceStoreClient, tracer trace.Tracer) *Handler {
	return &Handler{
		store:  store,
		tracer: tracer,
		log:    log.New("grafana-apiserver.keys"),
	}
}

// ListKeysFor returns the POST handler for one kind's cluster-wide keys endpoint.
//
// The response is a PartialObjectMetadataList carrying only namespace, name,
// resourceVersion and the grafana.app/folder annotation. Nothing from the object
// body is available, since no body is read, which is why this is its own endpoint
// rather than content negotiation on the normal list, where clients are promised
// complete metadata.
//
// Reconciling against this plus an event stream converges only if the caller:
//
//  1. Compares per-key resourceVersion, never a single global one. Versions are
//     assigned before commit, so a write can be missing from a snapshot while
//     carrying a version below that snapshot's.
//  2. Treats deletions as observable only by diffing a full snapshot, arbitrated
//     by the list's resourceVersion. They are absent from the list, not tombstoned.
//  3. Treats events as a latency optimization. They may be dropped, and the server
//     never reports that a resource version aged out; the relist is what converges.
//
// Known limitation: this always reads unified storage, so for a resource still
// served from legacy (dual-write mode 0-2) the result can be empty or stale while
// the normal list returns real data.
func (h *Handler) ListKeysFor(kind kindRef) http.HandlerFunc {
	return h.listKeys(kind, false)
}

// ListKeysInNamespaceFor returns the POST handler for one kind's namespaced keys
// endpoint. Open to any caller permitted to list the kind there.
func (h *Handler) ListKeysInNamespaceFor(kind kindRef) http.HandlerFunc {
	return h.listKeys(kind, true)
}

func (h *Handler) listKeys(kind kindRef, namespaced bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := h.tracer.Start(r.Context(), "keys.v1.listKeys", trace.WithAttributes(
			attribute.String("keys.group", kind.group),
			attribute.String("keys.version", kind.version),
			attribute.String("keys.resource", kind.resource),
		))
		defer span.End()

		// Empty for the cluster-wide route, which lists every namespace.
		namespace := ""
		if namespaced {
			var err error
			if namespace, err = namespaceFrom(ctx); err != nil {
				errhttp.Write(ctx, err, w)
				return
			}
			span.SetAttributes(attribute.String("keys.namespace", namespace))
		} else if err := h.requireClusterWideServiceCaller(ctx, kind); err != nil {
			errhttp.Write(ctx, err, w)
			return
		}

		opts, err := decodeListOptions(r)
		if err != nil {
			errhttp.Write(ctx, err, w)
			return
		}

		req := &resourcepb.ListRequest{
			KeysOnly:      true,
			Limit:         opts.Limit,
			NextPageToken: opts.Continue,
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Group:     kind.group,
					Resource:  kind.resource,
					Namespace: namespace,
				},
			},
		}

		if opts.ResourceVersion != "" {
			rv, err := strconv.ParseInt(opts.ResourceVersion, 10, 64)
			// A negative version parses but both backends read anything <= 0 as
			// unset and serve the latest, so it would answer a different question.
			// Zero is left alone: Kubernetes reads it as "any version".
			if err != nil || rv < 0 {
				errhttp.Write(ctx, apierrors.NewBadRequest(
					fmt.Sprintf("invalid resourceVersion: %q", opts.ResourceVersion)), w)
				return
			}
			req.ResourceVersion = rv
		}

		res, err := h.store.List(ctx, req)
		// AsErrorResult reads the structured result off the gRPC status details, so
		// the reason and code survive the wire instead of collapsing to Internal.
		if err != nil {
			h.log.FromContext(ctx).Error("list-keys failed",
				"group", kind.group, "resource", kind.resource,
				"namespace", namespace, "error", err)
			errhttp.Write(ctx, resource.GetError(resource.AsErrorResult(err)), w)
			return
		}
		// The backend also reports failures in the payload, not only as a transport error.
		if res.GetError() != nil {
			errhttp.Write(ctx, resource.GetError(res.GetError()), w)
			return
		}

		writeJSON(w, keysResults(res))
	}
}

const wildcardNamespace = "*"

// namespaceFrom resolves the namespace the route was mounted with.
func namespaceFrom(ctx context.Context) (string, error) {
	namespace, ok := request.NamespaceFrom(ctx)
	if !ok || namespace == "" {
		return "", apierrors.NewBadRequest("namespace is required")
	}
	// A wildcard would reach the backend as a namespace literally named "*".
	// Cluster-wide reads have their own route.
	if namespace == wildcardNamespace {
		return "", apierrors.NewBadRequest("listing keys across namespaces is not supported on the namespaced endpoint")
	}
	return namespace, nil
}

// requireClusterWideServiceCaller guards the cross-namespace read: an access policy,
// scoped to every namespace. Scope alone is not enough, because on-behalf-of copies the
// service token's namespace onto a user identity, and per-item authz allows some groups
// wholesale.
func (h *Handler) requireClusterWideServiceCaller(ctx context.Context, kind kindRef) error {
	gr := schema.GroupResource{Group: kind.group, Resource: kind.resource}

	info, ok := claims.AuthInfoFrom(ctx)
	if !ok || info == nil {
		return apierrors.NewUnauthorized("no identity found for request")
	}
	if !claims.IsIdentityType(info.GetIdentityType(), claims.TypeAccessPolicy) {
		h.log.FromContext(ctx).Warn("refused cluster-wide list-keys: not a service caller",
			"group", kind.group, "resource", kind.resource,
			"identityType", info.GetIdentityType(), "identityNamespace", info.GetNamespace())
		return apierrors.NewForbidden(gr, "",
			fmt.Errorf("listing keys across namespaces is limited to service callers, got %q", info.GetIdentityType()),
		)
	}
	if ns := info.GetNamespace(); ns != wildcardNamespace {
		h.log.FromContext(ctx).Warn("refused cluster-wide list-keys: identity is not scoped to all namespaces",
			"group", kind.group, "resource", kind.resource,
			"identityType", info.GetIdentityType(), "identityNamespace", ns)
		return apierrors.NewForbidden(gr, "",
			fmt.Errorf("listing keys across namespaces requires an identity scoped to %q, got %q", wildcardNamespace, ns),
		)
	}
	return nil
}

// honoredListOptions are the only ListOptions fields listing keys reads. Keeping
// it an allowlist means a field added upstream is refused rather than silently
// ignored, which for a selector would hand the caller an unfiltered list.
var honoredListOptions = []string{"limit", "continue", "resourceVersion"}

// firstUnhonoredField names the first field set that listing keys does not read,
// or "" when the caller sent only honored ones. Names come from the struct tags so
// there is no second list to fall out of step.
func firstUnhonoredField(opts *metav1.ListOptions) string {
	v := reflect.ValueOf(*opts)
	for i := range v.NumField() {
		name, _, _ := strings.Cut(v.Type().Field(i).Tag.Get("json"), ",")
		// TypeMeta is inline and so unnamed; its kind is checked separately.
		if name == "" || name == "-" || slices.Contains(honoredListOptions, name) {
			continue
		}
		if !v.Field(i).IsZero() {
			return name
		}
	}
	return ""
}

// An empty body means all defaults.
func decodeListOptions(r *http.Request) (*metav1.ListOptions, error) {
	opts := &metav1.ListOptions{}

	body := http.MaxBytesReader(nil, r.Body, maxRequestBody)
	dec := json.NewDecoder(body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(opts); err != nil {
		if !errors.Is(err, io.EOF) {
			return nil, apierrors.NewBadRequest(fmt.Sprintf("invalid request body: %s", err))
		}
		return opts, nil
	}
	// Anything after the first value means the caller sent more than one.
	if err := dec.Decode(&json.RawMessage{}); !errors.Is(err, io.EOF) {
		return nil, apierrors.NewBadRequest("request body must contain a single JSON object")
	}

	if opts.Kind != "" && opts.Kind != "ListOptions" {
		return nil, apierrors.NewBadRequest(fmt.Sprintf("expected kind ListOptions, got %q", opts.Kind))
	}
	if opts.Limit < 0 {
		return nil, apierrors.NewBadRequest("limit must not be negative")
	}

	if name := firstUnhonoredField(opts); name != "" {
		return nil, apierrors.NewBadRequest(fmt.Sprintf(
			"%s is not supported; listing keys accepts only %s",
			name, strings.Join(honoredListOptions, ", ")))
	}

	return opts, nil
}

// The list's resourceVersion is the snapshot every page is taken at; callers need
// it to arbitrate list-versus-event races. See ListKeysFor.
func keysResults(res *resourcepb.ListResponse) *metav1.PartialObjectMetadataList {
	apiVersion := metav1.SchemeGroupVersion.String()
	out := &metav1.PartialObjectMetadataList{
		TypeMeta: metav1.TypeMeta{
			APIVersion: apiVersion,
			Kind:       "PartialObjectMetadataList",
		},
		ListMeta: metav1.ListMeta{
			Continue:        res.GetNextPageToken(),
			ResourceVersion: strconv.FormatInt(res.GetResourceVersion(), 10),
		},
		Items: make([]metav1.PartialObjectMetadata, 0, len(res.GetItems())),
	}

	// Identical for every item.
	itemType := metav1.TypeMeta{APIVersion: apiVersion, Kind: "PartialObjectMetadata"}

	for _, item := range res.GetItems() {
		partial := metav1.PartialObjectMetadata{
			TypeMeta: itemType,
			ObjectMeta: metav1.ObjectMeta{
				// Per item: the list spans namespaces, so the caller cannot infer it.
				Namespace:       item.GetNamespace(),
				Name:            item.GetName(),
				ResourceVersion: strconv.FormatInt(item.GetResourceVersion(), 10),
			},
		}
		// Absent rather than empty, so "no folder" stays distinguishable.
		if folder := item.GetFolder(); folder != "" {
			partial.Annotations = map[string]string{utils.AnnoKeyFolder: folder}
		}
		out.Items = append(out.Items, partial)
	}

	return out
}

func writeJSON(w http.ResponseWriter, obj any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(obj)
}
