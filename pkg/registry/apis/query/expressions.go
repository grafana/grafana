package query

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	example "github.com/grafana/grafana/pkg/apis/example/v0alpha1"
	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/registry/apis/query/schema"
	"github.com/grafana/grafana/pkg/util/errutil/errhttp"
)

var (
	_ rest.Storage              = (*exprStorage)(nil)
	_ rest.Scoper               = (*exprStorage)(nil)
	_ rest.SingularNameProvider = (*exprStorage)(nil)
	_ rest.Lister               = (*exprStorage)(nil)
	_ rest.Getter               = (*exprStorage)(nil)
)

type exprStorage struct {
	resourceInfo   *common.ResourceInfo
	tableConverter rest.TableConvertor
	handler        *expr.ExpressionQueryReader
	vals           *query.QueryTypeDefinitionList
}

func newExprStorage(handler *expr.ExpressionQueryReader) (*exprStorage, error) {
	var resourceInfo = common.NewResourceInfo(query.GROUP, query.VERSION,
		"expressions", "expression", "DataSourceApiServer",
		func() runtime.Object { return &query.QueryTypeDefinition{} },
		func() runtime.Object { return &query.QueryTypeDefinitionList{} },
	)

	vals := &query.QueryTypeDefinitionList{}
	body, err := handler.QueryTypeDefinitionListJSON()
	if err != nil {
		return nil, err
	}
	err = json.Unmarshal(body, vals)
	if err != nil {
		return nil, err
	}

	field := ""
	for _, qt := range vals.Items {
		if field == "" {
			field = qt.Spec.DiscriminatorField
		} else if qt.Spec.DiscriminatorField != "" {
			if qt.Spec.DiscriminatorField != field {
				return nil, fmt.Errorf("only one discriminator field allowed")
			}
		}
	}

	return &exprStorage{
		resourceInfo:   &resourceInfo,
		tableConverter: rest.NewDefaultTableConvertor(resourceInfo.GroupResource()),
		handler:        handler,
		vals:           vals,
	}, nil
}

func (s *exprStorage) New() runtime.Object {
	return s.resourceInfo.NewFunc()
}

func (s *exprStorage) Destroy() {}

func (s *exprStorage) NamespaceScoped() bool {
	return false
}

func (s *exprStorage) GetSingularName() string {
	return example.DummyResourceInfo.GetSingularName()
}

func (s *exprStorage) NewList() runtime.Object {
	return s.resourceInfo.NewListFunc()
}

func (s *exprStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *exprStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	return s.vals, nil
}

func (s *exprStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	for idx, flag := range s.vals.Items {
		if flag.Name == name {
			return &s.vals.Items[idx], nil
		}
	}
	return nil, fmt.Errorf("not found")
}

func (b *QueryAPIBuilder) handleExpressionsSchema(w http.ResponseWriter, r *http.Request) {
	s, err := schema.GetQuerySchema(b.expr.vals)
	if err != nil {
		errhttp.Write(r.Context(), err, w)
		return
	}
	_ = json.NewEncoder(w).Encode(s)
}

type validateQueryREST struct {
	s *exprStorage
}

var _ = rest.Connecter(&validateQueryREST{})

func (r *validateQueryREST) New() runtime.Object {
	return &example.DummySubresource{}
}

func (r *validateQueryREST) Destroy() {
}

func (r *validateQueryREST) ConnectMethods() []string {
	return []string{"POST"}
}

func (r *validateQueryREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *validateQueryREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	// Find the expression
	for _, qt := range r.s.vals.Items {
		if qt.Name == name {
			return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
				// GenericDataQuery
				// This response object format is negotiated by k8s
				dummy := &example.DummySubresource{
					Info: fmt.Sprintf("%s/%s", name, name),
				}
				responder.Object(http.StatusOK, dummy)
			}), nil
		}
	}
	return nil, fmt.Errorf("not found")
}
