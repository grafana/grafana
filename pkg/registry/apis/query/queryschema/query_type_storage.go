package queryschema

import (
	"context"
	"net/http"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana-plugin-sdk-go/experimental/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	dsV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
)

var (
	_ rest.Storage              = (*queryTypeStorage)(nil)
	_ rest.Scoper               = (*queryTypeStorage)(nil)
	_ rest.SingularNameProvider = (*queryTypeStorage)(nil)
	_ rest.Lister               = (*queryTypeStorage)(nil)
	_ rest.Getter               = (*queryTypeStorage)(nil)

	// The connectors
	_ = rest.Connecter(&queryValidationREST{})
)

type queryTypeStorage struct {
	resourceInfo   *utils.ResourceInfo
	tableConverter rest.TableConvertor
	registry       dsV0.QueryTypeDefinitionList
}

type queryValidationREST struct {
	qt *queryTypeStorage
}

func RegisterQueryTypes(queryTypes *dsV0.QueryTypeDefinitionList, storage map[string]rest.Storage) error {
	if queryTypes == nil {
		return nil // NO error
	}

	resourceInfo := dsV0.QueryTypeDefinitionResourceInfo
	store := &queryTypeStorage{
		resourceInfo:   &resourceInfo,
		tableConverter: rest.NewDefaultTableConvertor(resourceInfo.GroupResource()),
		registry:       *queryTypes,
	}

	// Supports list+get for all query types
	storage[resourceInfo.StoragePath()] = store

	// Adds a query validation endpoint for each query type
	// We will also support the "<any>" or "*" name
	storage[resourceInfo.StoragePath("validate")] = &queryValidationREST{store}

	return nil
}

func (s *queryTypeStorage) New() runtime.Object {
	return s.resourceInfo.NewFunc()
}

func (s *queryTypeStorage) Destroy() {}

func (s *queryTypeStorage) NamespaceScoped() bool {
	return false
}

func (s *queryTypeStorage) GetSingularName() string {
	return s.resourceInfo.GetSingularName()
}

func (s *queryTypeStorage) NewList() runtime.Object {
	return s.resourceInfo.NewListFunc()
}

func (s *queryTypeStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *queryTypeStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	return &s.registry, nil
}

func (s *queryTypeStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	for idx, qt := range s.registry.Items {
		if qt.Name == name {
			return &s.registry.Items[idx], nil
		}
	}
	return nil, s.resourceInfo.NewNotFound(name)
}

//----------------------------------------------------
// The validation processor
//----------------------------------------------------

func (r *queryValidationREST) New() runtime.Object {
	return &dsV0.QueryDataRequest{}
}

func (r *queryValidationREST) Destroy() {
}

func (r *queryValidationREST) ConnectMethods() []string {
	return []string{"POST"}
}

func (r *queryValidationREST) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (r *queryValidationREST) ProducesObject(verb string) interface{} {
	return &dsV0.QueryDataRequest{}
}

func (r *queryValidationREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *queryValidationREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		// TODO -- validate/mutate the query
		// should we return the DQR, or raw validation response?
		qdr := &dsV0.QueryDataRequest{
			QueryDataRequest: v0alpha1.QueryDataRequest{
				Debug: true,
			},
		}

		if name == "*" || name == "{any}" {
			qdr.Queries = []v0alpha1.DataQuery{
				v0alpha1.NewDataQuery(
					map[string]any{
						"refId": "???",
						"HELLO": "world",
						"TODO":  "parse any query",
					},
				),
			}
		}

		responder.Object(http.StatusOK, qdr)
	}), nil
}
