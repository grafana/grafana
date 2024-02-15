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

	common "github.com/grafana/grafana/pkg/apis/common/v0alpha1"
	example "github.com/grafana/grafana/pkg/apis/example/v0alpha1"
	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/query/expr"
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
}

func newExprStorage(handler *expr.ExpressionQueryReader) (*exprStorage, error) {
	var resourceInfo = common.NewResourceInfo(query.GROUP, query.VERSION,
		"expressions", "expression", "DataSourceApiServer",
		func() runtime.Object { return &query.QueryTypeDefinition{} },
		func() runtime.Object { return &query.QueryTypeDefinitionList{} },
	)
	return &exprStorage{
		resourceInfo:   &resourceInfo,
		tableConverter: rest.NewDefaultTableConvertor(resourceInfo.GroupResource()),
		handler:        handler,
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
	return s.handler.QueryTypeDefinitionList(), nil
}

func (s *exprStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	expr := s.handler.QueryTypeDefinitionList()
	for idx, flag := range expr.Items {
		if flag.Name == name {
			return &expr.Items[idx], nil
		}
	}
	return nil, fmt.Errorf("not found")
}

func (b *QueryAPIBuilder) handleExpressionsSchema(w http.ResponseWriter, r *http.Request) {
	s, err := schema.GetQuerySchema(b.handler.QueryTypeDefinitionList())
	if err != nil {
		errhttp.Write(r.Context(), err, w)
		return
	}
	_ = json.NewEncoder(w).Encode(s)
}
