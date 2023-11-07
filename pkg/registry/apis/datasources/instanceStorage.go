package datasources

import (
	"context"
	"crypto/sha256"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apis/datasources/v0alpha1"
	"github.com/grafana/grafana/pkg/services/datasources"
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
	builder       *DSAPIBuilder
}

func (s *instanceStorage) New() runtime.Object {
	return &v0alpha1.InstanceInfo{}
}

func (s *instanceStorage) Destroy() {}

func (s *instanceStorage) NamespaceScoped() bool {
	return true
}

func (s *instanceStorage) GetSingularName() string {
	return s.groupResource.Resource
}

func (s *instanceStorage) NewList() runtime.Object {
	return &v0alpha1.InstanceInfoList{}
}

func (s *instanceStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return rest.NewDefaultTableConvertor(s.groupResource).ConvertToTable(ctx, object, tableOptions)
}

func (s *instanceStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	ds, err := s.builder.getDataSource(ctx, name)
	if err != nil {
		return nil, err
	}
	return s.asInstance(ds), nil
}

func (s *instanceStorage) asInstance(ds *datasources.DataSource) *v0alpha1.InstanceInfo {
	h := sha256.New()
	h.Write([]byte(fmt.Sprintf("%d/%s", ds.Created.UnixMilli(), ds.UID)))
	uid := fmt.Sprintf("%x", h.Sum(nil))

	return &v0alpha1.InstanceInfo{
		TypeMeta: metav1.TypeMeta{
			Kind:       "InstanceInfo",
			APIVersion: s.apiVersion,
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:              ds.UID,
			Namespace:         s.builder.namespacer(ds.OrgID),
			CreationTimestamp: metav1.NewTime(ds.Created),
			ResourceVersion:   fmt.Sprintf("%d", ds.Updated.UnixMilli()),
			UID:               types.UID(uid), // make it different so we don't confuse it with "name"
		},
		Title: ds.Name,
	}
}

func (s *instanceStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	result := &v0alpha1.InstanceInfoList{
		TypeMeta: metav1.TypeMeta{
			Kind:       "DataSourceConfigList",
			APIVersion: s.apiVersion,
		},
		Items: []v0alpha1.InstanceInfo{},
	}
	vals, err := s.builder.getDataSources(ctx)
	if err == nil {
		for _, ds := range vals {
			result.Items = append(result.Items, *s.asInstance(ds))
		}
	}
	return result, err
}
