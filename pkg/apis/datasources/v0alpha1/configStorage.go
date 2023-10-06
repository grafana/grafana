package v0alpha1

import (
	"context"
	"fmt"

	grafanarequest "github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"
)

var (
	_ rest.Scoper               = (*configStorage)(nil)
	_ rest.SingularNameProvider = (*configStorage)(nil)
	_ rest.Getter               = (*configStorage)(nil)
	_ rest.Lister               = (*configStorage)(nil)
	_ rest.Storage              = (*configStorage)(nil)
)

type configStorage struct {
	apiVersion    string
	groupResource schema.GroupResource
}

func (s *configStorage) New() runtime.Object {
	return &DataSourceConfig{}
}

func (s *configStorage) Destroy() {}

func (s *configStorage) NamespaceScoped() bool {
	return true
}

func (s *configStorage) GetSingularName() string {
	return s.groupResource.Resource
}

func (s *configStorage) NewList() runtime.Object {
	return &DataSourceConfigList{}
}

func (s *configStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return rest.NewDefaultTableConvertor(s.groupResource).ConvertToTable(ctx, object, tableOptions)
}

func (s *configStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	orgId, ok := grafanarequest.OrgIDFrom(ctx)
	if !ok {
		orgId = 1 // TODO: default org ID 1 for now
	}

	return &DataSourceConfig{
		TypeMeta: metav1.TypeMeta{
			Kind:       "DataSourceConfig",
			APIVersion: s.apiVersion,
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: fmt.Sprintf("org-%d", orgId),
		},
		Spec: map[string]any{
			"hello": "world",
		},
	}, nil
}

func (s *configStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	return &DataSourceConfigList{
		TypeMeta: metav1.TypeMeta{
			Kind:       "DataSourceConfigList",
			APIVersion: s.apiVersion,
		},
		Items: []DataSourceConfig{
			// TODO....
		},
	}, nil
}
