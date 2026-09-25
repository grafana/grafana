package search

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"strconv"

	"github.com/grafana/authlib/types"
	"github.com/open-feature/go-sdk/openfeature"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/selection"
	apirequest "k8s.io/apiserver/pkg/endpoints/request"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/alertrule"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

// HybridHandler uses unified storage directly because external collections are
// populated independently of the rules' dual-writer storage mode.
type HybridHandler struct {
	client resourcepb.ResourceIndexClient
}

func NewHybridHandler(client resourcepb.ResourceIndexClient) *HybridHandler {
	return &HybridHandler{client: client}
}

var errHybridSearchNotConfigured = errutil.NotImplemented("alerting.hybridSearchNotConfigured")

func (h *HybridHandler) Search(w http.ResponseWriter, req *http.Request) {
	out, err := h.search(req.Context(), req)
	if err != nil {
		errhttp.Write(req.Context(), err, w)
		return
	}
	_ = writeJSON(w, out)
}

func (h *HybridHandler) search(ctx context.Context, req *http.Request) (*resourcepb.HybridSearchResponse, error) {
	if !openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagAlertingHybridSearch, false, openfeature.TransactionContext(ctx)) {
		return nil, apierrors.NewNotFound(schema.GroupResource{Group: model.APIGroup, Resource: HybridRouteResource}, "hybrid")
	}
	namespace := apirequest.NamespaceValue(ctx)
	if namespace == "" || namespace == "*" {
		return nil, apierrors.NewBadRequest("a single namespace is required")
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, apierrors.NewUnauthorized("valid user is required")
	}
	if !types.NamespaceMatches(user.GetNamespace(), namespace) {
		return nil, apierrors.NewForbidden(alertrule.ResourceInfo.GroupResource(), "", errors.New("namespace mismatch"))
	}
	query, err := url.ParseQuery(req.URL.RawQuery)
	if err != nil {
		return nil, apierrors.NewBadRequest(err.Error())
	}
	limit := int64(50)
	if l, err := strconv.ParseInt(query.Get("limit"), 10, 64); err == nil && l > 0 {
		limit = l
	}
	searchReq := &resourcepb.HybridSearchRequest{
		Key:           resourceKey(namespace, alertrule.ResourceInfo.GroupResource()),
		Query:         query.Get("query"),
		SemanticQuery: query.Get("semanticQuery"),
		Limit:         limit,
		MinRelevance:  query.Get("minRelevance"),
		SkipRerank:    query.Get("skipRerank") == "true",
	}
	if f := query.Get("folder"); f != "" {
		searchReq.Filters = []*resourcepb.Requirement{{
			Key: "folder", Operator: string(selection.In), Values: []string{folder.ToLegacyFolderUID(f)},
		}}
	}
	resp, err := h.client.HybridSearch(ctx, searchReq)
	if err != nil {
		if status.Code(err) == codes.Unimplemented {
			return nil, errHybridSearchNotConfigured.Errorf("hybrid search is not configured on this instance")
		}
		return nil, resource.GetError(resource.AsErrorResult(err))
	}
	return resp, nil
}
