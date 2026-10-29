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
	"strconv"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"

	claims "github.com/grafana/authlib/types"

	storagev0 "github.com/grafana/grafana/pkg/apis/storage/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

// ListKeyRequest is small, so anything larger is a client bug or an attack.
const maxRequestBody = 1 << 20 // 1 MiB

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
// The response is a ListKeyResponse carrying only namespace, name, resourceVersion
// and folder. Nothing from the object body is available, since no body is read,
// which is why this is its own endpoint rather than content negotiation on the
// normal list, where clients are promised complete metadata.
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

		opts, err := decodeListKeyRequest(r)
		if err != nil {
			errhttp.Write(ctx, err, w)
			return
		}

		if r.URL.Query().Get(TerminatingParam) == "true" {
			if namespaced {
				errhttp.Write(ctx, apierrors.NewBadRequest(TerminatingParam+" is only served cluster-wide"), w)
				return
			}
			h.listTerminating(ctx, w, kind)
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
			errhttp.Write(ctx, resource.StatusError(resource.AsErrorResult(err)), w)
			return
		}
		// The backend also reports failures in the payload, not only as a transport error.
		if res.GetError() != nil {
			errhttp.Write(ctx, resource.StatusError(res.GetError()), w)
			return
		}

		writeJSON(w, keysResults(res))
	}
}

// TerminatingParam is the query parameter that narrows the cluster-wide list to objects that are
// soft-deleted but still held by finalizers. It is a single unpaged page without resourceVersions:
// a hint for a controller to re-fetch, not a snapshot.
const TerminatingParam = "terminating"

func (h *Handler) listTerminating(ctx context.Context, w http.ResponseWriter, kind kindRef) {
	res, err := h.store.ListTerminating(ctx, &resourcepb.ListTerminatingRequest{Group: kind.group, Resource: kind.resource})
	if status.Code(err) == codes.Unimplemented {
		// Reads as "route absent" to the client, which then falls back to the full list.
		errhttp.Write(ctx, apierrors.NewMethodNotSupported(schema.GroupResource{Group: kind.group, Resource: kind.resource}, "list-terminating"), w)
		return
	}
	if err != nil {
		h.log.FromContext(ctx).Error("list-terminating failed", "group", kind.group, "resource", kind.resource, "error", err)
		errhttp.Write(ctx, resource.StatusError(resource.AsErrorResult(err)), w)
		return
	}
	out := &storagev0.ListKeyResponse{
		TypeMeta:        metav1.TypeMeta{APIVersion: storagev0.APIVERSION, Kind: storagev0.KindListKeyResponse},
		ResourceVersion: "0",
		Items:           make([]storagev0.ListKeyItem, 0, len(res.GetItems())),
	}
	for _, item := range res.GetItems() {
		out.Items = append(out.Items, storagev0.ListKeyItem{Namespace: item.GetNamespace(), Name: item.GetName(), ResourceVersion: "0"})
	}
	writeJSON(w, out)
}

// kindRef identifies the kind a route serves. Only group and resource reach the
// storage key (which is group/resource/namespace/name); version serves the trace
// attribute and the per-version operation ID.
type kindRef struct {
	group    string
	version  string
	resource string
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

// An empty body means all defaults.
func decodeListKeyRequest(r *http.Request) (*storagev0.ListKeyRequest, error) {
	opts := &storagev0.ListKeyRequest{}

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

	if opts.APIVersion != "" && opts.APIVersion != storagev0.APIVERSION {
		return nil, apierrors.NewBadRequest(fmt.Sprintf("apiVersion must be %q, got %q", storagev0.APIVERSION, opts.APIVersion))
	}
	if opts.Kind != "" && opts.Kind != storagev0.KindListKeyRequest {
		return nil, apierrors.NewBadRequest(fmt.Sprintf("kind must be %q, got %q", storagev0.KindListKeyRequest, opts.Kind))
	}
	if opts.Limit < 0 {
		return nil, apierrors.NewBadRequest("limit must not be negative")
	}

	return opts, nil
}

// The list's resourceVersion is the snapshot every page is taken at; callers need
// it to arbitrate list-versus-event races. See ListKeysFor.
func keysResults(res *resourcepb.ListResponse) *storagev0.ListKeyResponse {
	out := &storagev0.ListKeyResponse{
		TypeMeta: metav1.TypeMeta{
			APIVersion: storagev0.APIVERSION,
			Kind:       storagev0.KindListKeyResponse,
		},
		Continue:        res.GetNextPageToken(),
		ResourceVersion: strconv.FormatInt(res.GetResourceVersion(), 10),
		Items:           make([]storagev0.ListKeyItem, 0, len(res.GetItems())),
	}

	for _, item := range res.GetItems() {
		out.Items = append(out.Items, storagev0.ListKeyItem{
			Namespace:       item.GetNamespace(),
			Name:            item.GetName(),
			ResourceVersion: strconv.FormatInt(item.GetResourceVersion(), 10),
			Folder:          item.GetFolder(),
		})
	}

	return out
}

func writeJSON(w http.ResponseWriter, obj any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(obj)
}
