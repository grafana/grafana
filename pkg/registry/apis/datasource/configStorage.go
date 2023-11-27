package datasource

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

	"github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/services/datasources"
)

var (
	_ rest.Storage              = (*configStorage)(nil)
	_ rest.Scoper               = (*configStorage)(nil)
	_ rest.SingularNameProvider = (*configStorage)(nil)
	_ rest.Getter               = (*configStorage)(nil)
	_ rest.Lister               = (*configStorage)(nil)
)

type configStorage struct {
	apiVersion    string
	groupResource schema.GroupResource
	builder       *DSAPIBuilder
}

func (s *configStorage) New() runtime.Object {
	return &v0alpha1.DataSourceConfig{}
}

func (s *configStorage) Destroy() {}

func (s *configStorage) NamespaceScoped() bool {
	return true
}

func (s *configStorage) GetSingularName() string {
	return s.groupResource.Resource
}

func (s *configStorage) NewList() runtime.Object {
	return &v0alpha1.DataSourceConfigList{}
}

func (s *configStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return rest.NewDefaultTableConvertor(s.groupResource).ConvertToTable(ctx, object, tableOptions)
}

func (s *configStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	ds, err := s.builder.getDataSource(ctx, name)
	if err != nil {
		return nil, err
	}
	return s.asConfig(ds), nil
}

func (s *configStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	result := &v0alpha1.DataSourceConfigList{
		Items: []v0alpha1.DataSourceConfig{},
	}
	vals, err := s.builder.getDataSources(ctx)
	if err == nil {
		for _, ds := range vals {
			result.Items = append(result.Items, *s.asConfig(ds))
		}
	}
	return result, err
}

func (s *configStorage) asConfig(ds *datasources.DataSource) *v0alpha1.DataSourceConfig {
	h := sha256.New()
	h.Write([]byte(fmt.Sprintf("%d/%s", ds.Created.UnixMilli(), ds.UID)))
	uid := fmt.Sprintf("%x", h.Sum(nil))

	return &v0alpha1.DataSourceConfig{
		ObjectMeta: metav1.ObjectMeta{
			Name:              ds.UID,
			Namespace:         s.builder.namespacer(ds.OrgID),
			CreationTimestamp: metav1.NewTime(ds.Created),
			ResourceVersion:   fmt.Sprintf("%d", ds.Updated.UnixMilli()),
			UID:               types.UID(uid), // make it different so we don't confuse it with "name"
		},
		Spec: map[string]any{
			"XXX": ds.JsonData,
		},
		SecureJSON: map[string]string{
			"TODO": "only when we know security is good enough",
		},
	}
}
