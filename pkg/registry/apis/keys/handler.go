// Package keys serves the keys-only list endpoint, at
// POST /apis/{group}/{version}/{resource}/list-keys.
//
// It reads identities out of unified storage without fetching object bodies, so a
// controller can take a state-of-the-world snapshot cheaply. Cluster-scoped: one
// call covers every namespace, so the caller's identity must cover them too.
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
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

// ListOptions is small, so anything larger is a client bug or an attack.
const maxRequestBody = 1 << 20 // 1 MiB

type kindRef struct {
	group    string
	version  string
	resource string
	kind     string
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

// ListKeysFor returns the POST handler for one kind's keys endpoint.
//
// The response is a PartialObjectMetadataList carrying only namespace, name,
// resourceVersion and the grafana.app/folder annotation. Nothing from the object
// body is available, since no body is read — which is why this is its own endpoint
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
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := h.tracer.Start(r.Context(), "keys.v1.listKeys", trace.WithAttributes(
			attribute.String("keys.group", kind.group),
			attribute.String("keys.version", kind.version),
			attribute.String("keys.resource", kind.resource),
		))
		defer span.End()

		if err := requireClusterWideServiceIdentity(ctx); err != nil {
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
					Group:    kind.group,
					Resource: kind.resource,
				},
			},
		}

		if opts.ResourceVersion != "" {
			rv, err := strconv.ParseInt(opts.ResourceVersion, 10, 64)
			if err != nil {
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

// requireClusterWideServiceIdentity accepts only the service identity. The read
// it performs is cluster-wide, so only the "*" namespace is allowed.
func requireClusterWideServiceIdentity(ctx context.Context) error {
	info, ok := claims.AuthInfoFrom(ctx)
	if !ok || info == nil {
		return apierrors.NewUnauthorized("no identity found for request")
	}
	if !identity.IsServiceIdentity(ctx) {
		return apierrors.NewForbidden(
			schema.GroupResource{}, "",
			fmt.Errorf("listing keys is only available to the service identity, got %q", info.GetIdentityType()),
		)
	}
	if ns := info.GetNamespace(); ns != "*" {
		return apierrors.NewForbidden(
			schema.GroupResource{}, "",
			fmt.Errorf("listing keys is cluster-wide and requires an identity scoped to %q, got %q", "*", ns),
		)
	}
	return nil
}

// Refused rather than ignored: silently dropping a selector would hand the caller
// an unfiltered list.
type unsupportedListOption struct {
	name string
	set  func(*metav1.ListOptions) bool
}

var unsupportedListOptions = []unsupportedListOption{
	{"labelSelector", func(o *metav1.ListOptions) bool { return o.LabelSelector != "" }},
	{"fieldSelector", func(o *metav1.ListOptions) bool { return o.FieldSelector != "" }},
	{"watch", func(o *metav1.ListOptions) bool { return o.Watch }},
	{"allowWatchBookmarks", func(o *metav1.ListOptions) bool { return o.AllowWatchBookmarks }},
	{"sendInitialEvents", func(o *metav1.ListOptions) bool { return o.SendInitialEvents != nil }},
	{"timeoutSeconds", func(o *metav1.ListOptions) bool { return o.TimeoutSeconds != nil }},
	{"resourceVersionMatch", func(o *metav1.ListOptions) bool { return o.ResourceVersionMatch != "" }},
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

	for _, opt := range unsupportedListOptions {
		if opt.set(opts) {
			return nil, apierrors.NewBadRequest(
				fmt.Sprintf("%s is not supported when listing keys", opt.name))
		}
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
