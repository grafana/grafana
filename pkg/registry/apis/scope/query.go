package scope

import (
	"context"
	"fmt"
	"time"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	scope "github.com/grafana/grafana/pkg/apis/scope/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/utils"
)

var (
	_ rest.Storage              = (*scopeQuery)(nil)
	_ rest.SingularNameProvider = (*scopeQuery)(nil)
	_ rest.Scoper               = (*scopeQuery)(nil)
	_ rest.Lister               = (*scopeQuery)(nil)
)

type scopeQuery struct {
	nodes          *storage
	tableConverter rest.TableConvertor
}

func newScopeQuery(nodes *storage) *scopeQuery {
	return &scopeQuery{
		nodes: nodes,
		tableConverter: utils.NewTableConverter(
			scope.ScopeNodeResourceInfo.GroupResource(),
			[]metav1.TableColumnDefinition{
				{Name: "Name", Type: "string", Format: "name"},
				{Name: "Created At", Type: "date"},
			},
			func(obj any) ([]interface{}, error) {
				m, ok := obj.(*scope.Scope)
				if !ok {
					return nil, fmt.Errorf("expected scope")
				}
				return []interface{}{
					m.Name,
					m.CreationTimestamp.UTC().Format(time.RFC3339),
				}, nil
			},
		),
	}
}

func (s *scopeQuery) Destroy() {}

func (s *scopeQuery) NamespaceScoped() bool {
	return true
}

func (s *scopeQuery) GetSingularName() string {
	return "xyz" // not sure if this is actually used, but it is required to exist
}

func (s *scopeQuery) New() runtime.Object {
	return &scope.ScopeNode{}
}

func (s *scopeQuery) NewList() runtime.Object {
	return &scope.ScopeNodeList{}
}

func (s *scopeQuery) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *scopeQuery) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	return &scope.ScopeNodeList{
		Items: []scope.ScopeNode{
			scope.ScopeNode{ObjectMeta: v1.ObjectMeta{
				Name: "A",
			}},
		},
	}, nil
}
