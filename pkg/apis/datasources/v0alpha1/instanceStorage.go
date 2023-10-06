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
	_ rest.Scoper               = (*instanceStorage)(nil)
	_ rest.SingularNameProvider = (*instanceStorage)(nil)
	_ rest.Getter               = (*instanceStorage)(nil)
	_ rest.Lister               = (*instanceStorage)(nil)
	_ rest.Storage              = (*instanceStorage)(nil)
)

type instanceStorage struct {
	apiVersion    string
	groupResource schema.GroupResource
}

func (s *instanceStorage) New() runtime.Object {
	return &InstanceInfo{}
}

func (s *instanceStorage) Destroy() {}

func (s *instanceStorage) NamespaceScoped() bool {
	return true
}

func (s *instanceStorage) GetSingularName() string {
	return s.groupResource.Resource
}

func (s *instanceStorage) NewList() runtime.Object {
	return &InstanceInfoList{}
}

func (s *instanceStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return rest.NewDefaultTableConvertor(s.groupResource).ConvertToTable(ctx, object, tableOptions)
}

func (s *instanceStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	orgId, ok := grafanarequest.OrgIDFrom(ctx)
	if !ok {
		orgId = 1 // TODO: default org ID 1 for now
	}

	return &InstanceInfo{
		TypeMeta: metav1.TypeMeta{
			Kind:       "InstanceInfo",
			APIVersion: s.apiVersion,
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: fmt.Sprintf("org-%d", orgId),
			Labels: map[string]string{
				"key": "value",
			},
		},
		Title:       "the title",
		Description: "a description of this data source",
	}, nil
}

func (s *instanceStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	return &InstanceInfoList{
		TypeMeta: metav1.TypeMeta{
			Kind:       "DataSourceConfigList",
			APIVersion: s.apiVersion,
		},
		Items: []InstanceInfo{
			{
				TypeMeta: metav1.TypeMeta{
					Kind:       "InstanceInfo",
					APIVersion: s.apiVersion,
				},
				ObjectMeta: metav1.ObjectMeta{
					Name:      "aaa",
					Namespace: fmt.Sprintf("org-%d", 1),
					Labels: map[string]string{
						"key": "value",
					},
				},
				Title:       "the title",
				Description: "a description of this data source",
			},
		},
	}, nil
}
