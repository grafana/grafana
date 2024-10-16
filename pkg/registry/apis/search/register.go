package search

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	genericapiserver "k8s.io/apiserver/pkg/server"
	common "k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana/pkg/api/response"
	request2 "github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

var _ builder.APIGroupBuilder = (*SearchAPIBuilder)(nil)

type SearchAPIBuilder struct {
	unified    resource.ResourceClient
	namespacer request2.NamespaceMapper
}

func NewSearchAPIBuilder(
	unified resource.ResourceClient,
	cfg *setting.Cfg,
) (*SearchAPIBuilder, error) {
	return &SearchAPIBuilder{
		unified:    unified,
		namespacer: request2.GetNamespaceMapper(cfg),
	}, nil
}

func RegisterAPIService(
	features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	unified resource.ResourceClient,
	cfg *setting.Cfg,
) (*SearchAPIBuilder, error) {
	if !(features.IsEnabledGlobally(featuremgmt.FlagUnifiedStorageSearch) || features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs)) {
		return nil, nil
	}
	builder, err := NewSearchAPIBuilder(unified, cfg)
	apiregistration.RegisterAPI(builder)
	return builder, err
}

func (b *SearchAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return schema.GroupVersion{Group: "search.grafana.app", Version: "v0alpha1"}
}

func (b *SearchAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	return nil
}

func (b *SearchAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return func(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
		return map[string]common.OpenAPIDefinition{}
	}
}

func (b *SearchAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	return &builder.APIRoutes{
		Namespace: []builder.APIRouteHandler{
			{
				Path: "search",
				Spec: &spec3.PathProps{
					Get: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							Tags:        []string{"Search"},
							Summary:     "Search",
							Description: "Search for resources",
						},
					},
				},
				Handler: func(w http.ResponseWriter, r *http.Request) {
					// get tenant
					orgId, err := request2.OrgIDForList(r.Context())
					if err != nil {
						response.Error(500, "failed to get orgId", err)
					}
					tenant := b.namespacer(orgId)

					queryParams, err := url.ParseQuery(r.URL.RawQuery)
					if err != nil {
						response.Error(500, "failed to parse query params", err)
					}

					// get limit and offset from query params
					limit := 0
					offset := 0
					if queryParams.Has("limit") {
						limit, _ = strconv.Atoi(queryParams.Get("limit"))
					}
					if queryParams.Has("offset") {
						offset, _ = strconv.Atoi(queryParams.Get("offset"))
					}

					searchRequest := &resource.SearchRequest{
						Tenant:    tenant,
						Kind:      queryParams.Get("kind"),
						QueryType: queryParams.Get("queryType"),
						Query:     queryParams.Get("query"),
						Limit:     int64(limit),
						Offset:    int64(offset),
					}

					res, err := b.unified.Search(r.Context(), searchRequest)
					if err != nil {
						response.Error(500, "search request failed", err)
					}

					// TODO need a nicer way of handling this
					// the [][]byte response already contains the marshalled JSON, so we don't need to re-encode it
					rawMessages := make([]json.RawMessage, len(res.GetItems()))
					for i, item := range res.GetItems() {
						rawMessages[i] = item.Value
					}

					w.Header().Set("Content-Type", "application/json")
					if err := json.NewEncoder(w).Encode(rawMessages); err != nil {
						response.Error(500, "failed to json encode raw response", err)
					}
				},
			},
		},
	}
}

func (b *SearchAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return nil
}

func (b *SearchAPIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	return oas, nil
}

func (b *SearchAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, _ builder.APIGroupOptions) error {
	apiGroupInfo.PrioritizedVersions = []schema.GroupVersion{b.GetGroupVersion()}
	return nil
}
