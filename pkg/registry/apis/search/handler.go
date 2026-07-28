// Package search also serves the search.grafana.app endpoints that are mounted
// under a resource, for example POST .../namespaces/{ns}/dashboards/search.
package search

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"

	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

// maxRequestBody bounds the envelope we are willing to parse. Queries are small,
// so anything larger is a client bug or an attack.
const maxRequestBody = 1 << 20 // 1 MiB

// wildcardNamespace is what an identity scoped to every namespace carries. It is
// never a namespace that can be searched.
const wildcardNamespace = "*"

// kindRef identifies the kind a search endpoint is mounted under. Kind is
// carried separately because result rows only name the resource.
type kindRef struct {
	group    string
	version  string
	resource string
	kind     string
}

func (k kindRef) gvr() schema.GroupVersionResource {
	return schema.GroupVersionResource{Group: k.group, Version: k.version, Resource: k.resource}
}

// Handler serves the search envelope endpoints for one kind.
type Handler struct {
	client   resourcepb.ResourceIndexClient
	provider resource.SearchFieldsProvider
	tracer   trace.Tracer
	log      log.Logger
}

func NewHandler(client resourcepb.ResourceIndexClient, provider resource.SearchFieldsProvider, tracer trace.Tracer) *Handler {
	return &Handler{
		client:   client,
		provider: provider,
		tracer:   tracer,
		log:      log.New("grafana-apiserver.search"),
	}
}

// SearchFor returns the POST handler for the search endpoint of one kind.
func (h *Handler) SearchFor(kind kindRef) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := h.tracer.Start(r.Context(), "search.v1.search", trace.WithAttributes(
			attribute.String("search.group", kind.group),
			attribute.String("search.version", kind.version),
			attribute.String("search.resource", kind.resource),
		))
		defer span.End()

		namespace, err := requestNamespace(r)
		if err != nil {
			errhttp.Write(ctx, err, w)
			return
		}

		var q searchv0.SearchQuery
		if err := decodeBody(r, &q); err != nil {
			errhttp.Write(ctx, err, w)
			return
		}

		req, ferrs := TranslateSearchQuery(&q, kind.gvr(), namespace, h.provider)
		if len(ferrs) > 0 {
			errhttp.Write(ctx, apierrors.NewInvalid(
				schema.GroupKind{Group: searchv0.GROUP, Kind: searchv0.KindSearchQuery}, "", ferrs), w)
			return
		}

		res, err := h.client.Search(ctx, req)
		if err != nil {
			errhttp.Write(ctx, err, w)
			return
		}
		// The backend reports failures in the payload, not as a transport error.
		if res.GetError() != nil {
			errhttp.Write(ctx, resource.GetError(res.GetError()), w)
			return
		}

		out, err := searchResults(res, kind, req.Limit)
		if err != nil {
			errhttp.Write(ctx, err, w)
			return
		}
		writeJSON(w, out)
	}
}

// requestNamespace returns the namespace the request targets.
//
// It does not check whether the caller may reach that namespace. The apiserver
// authorization chain already decided that before dispatching here, and it
// knows cases a comparison here would miss, such as Grafana admins reaching
// another namespace. Repeating the decision here only risks contradicting it.
// Results are authorized per item against the caller regardless.
func requestNamespace(r *http.Request) (string, error) {
	namespace, ok := request.NamespaceFrom(r.Context())
	if !ok || namespace == "" {
		return "", apierrors.NewBadRequest("namespace is required")
	}
	// Searching every namespace at once is not supported. This is about what the
	// endpoint offers, not about who the caller is: a wildcard here would reach
	// the backend as a namespace literally named "*".
	if namespace == wildcardNamespace {
		return "", apierrors.NewBadRequest("searching across namespaces is not supported")
	}
	return namespace, nil
}

func decodeBody(r *http.Request, into any) error {
	body := http.MaxBytesReader(nil, r.Body, maxRequestBody)
	dec := json.NewDecoder(body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(into); err != nil {
		if errors.Is(err, io.EOF) {
			return apierrors.NewBadRequest("request body is empty")
		}
		return apierrors.NewBadRequest(fmt.Sprintf("invalid request body: %s", err))
	}
	// Anything after the first value means the caller sent something other than
	// the single query we are about to act on.
	if err := dec.Decode(&json.RawMessage{}); !errors.Is(err, io.EOF) {
		return apierrors.NewBadRequest("request body must contain a single JSON object")
	}
	return nil
}

func writeJSON(w http.ResponseWriter, obj any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(obj)
}

func metaForKind(kind string) metav1.TypeMeta {
	return metav1.TypeMeta{APIVersion: searchv0.APIVERSION, Kind: kind}
}
