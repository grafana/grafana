package search

import (
	"context"
	"net/http"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

// HybridSearchClient allows hybrid routes to use the existing RPC without
// requiring lexical-only search clients to implement it.
type HybridSearchClient interface {
	HybridSearch(context.Context, *resourcepb.HybridSearchRequest, ...grpc.CallOption) (*resourcepb.HybridSearchResponse, error)
}

type HybridHandler struct {
	client HybridSearchClient
	tracer trace.Tracer
}

func NewHybridHandler(client HybridSearchClient, tracer trace.Tracer) *HybridHandler {
	return &HybridHandler{client: client, tracer: tracer}
}

var (
	errHybridNotConfigured = errutil.NotImplemented("search.hybridNotConfigured",
		errutil.WithPublicMessage("hybrid search is not configured or is unsupported by the storage service"))
	errHybridNotEnrolled = errutil.NotFound("search.hybridNotEnrolled",
		errutil.WithPublicMessage("hybrid search is not enabled for this resource"))
)

// HybridSearchFor returns the POST handler for one resource's hybrid search.
func (h *HybridHandler) HybridSearchFor(kind kindRef) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := h.tracer.Start(r.Context(), "search.v1.hybrid", trace.WithAttributes(
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
		var q searchv0.HybridSearchQuery
		if err := decodeBody(r, &q); err != nil {
			errhttp.Write(ctx, err, w)
			return
		}
		req, ferrs := TranslateHybridSearchQuery(&q, kind.gvr(), namespace)
		if len(ferrs) > 0 {
			errhttp.Write(ctx, apierrors.NewInvalid(
				schema.GroupKind{Group: searchv0.GROUP, Kind: searchv0.KindHybridSearchQuery}, "", ferrs), w)
			return
		}

		res, err := h.client.HybridSearch(ctx, req)
		if err != nil {
			errhttp.Write(ctx, hybridSearchError(err), w)
			return
		}
		writeJSON(w, hybridSearchResults(res, kind))
	}
}

func hybridSearchError(err error) error {
	switch status.Code(err) {
	case codes.Unimplemented:
		// Storage owns lexical-only fallback. Preserve Unimplemented for older
		// services without RPC support or deployments without a search index.
		return errHybridNotConfigured.Errorf("hybrid search is not configured: %w", err)
	case codes.NotFound:
		return errHybridNotEnrolled.Errorf("hybrid search is not enabled for this resource: %w", err)
	case codes.Unavailable:
		return apierrors.NewServiceUnavailable("hybrid search is temporarily unavailable")
	default:
		return resource.StatusErrorFromResponse(nil, err)
	}
}

func hybridSearchResults(res *resourcepb.HybridSearchResponse, kind kindRef) *searchv0.HybridSearchResults {
	items := make([]searchv0.HybridSearchResultItem, 0, len(res.GetResults()))
	for _, hit := range res.GetResults() {
		chunks := make([]searchv0.HybridSearchChunk, 0, len(hit.GetChunks()))
		for _, chunk := range hit.GetChunks() {
			chunks = append(chunks, searchv0.HybridSearchChunk{
				Subresource: chunk.GetSubresource(),
				Content:     chunk.GetContent(),
			})
		}
		item := searchv0.HybridSearchResultItem{
			Resource: searchv0.ResourceRef{
				Group: kind.group, Resource: kind.resource, Kind: kind.kind, Name: hit.GetKey().GetName(),
			},
			Score:       hit.GetScore(),
			Title:       hit.GetTitle(),
			Folder:      hit.GetFolder(),
			FolderTitle: hit.GetFolderTitle(),
			Chunks:      chunks,
		}
		if hit.GetManagedByKind() != "" || hit.GetManagedById() != "" {
			item.ManagedBy = &searchv0.HybridSearchManagedBy{Kind: hit.GetManagedByKind(), ID: hit.GetManagedById()}
		}
		items = append(items, item)
	}
	return &searchv0.HybridSearchResults{
		TypeMeta: metaForKind(searchv0.KindHybridSearchResults),
		Items:    items,
	}
}
