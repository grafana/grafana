package datasource

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apis"
	"github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/kinds"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
)

var (
	_ rest.Scoper               = (*configAccess)(nil)
	_ rest.SingularNameProvider = (*configAccess)(nil)
	_ rest.Getter               = (*configAccess)(nil)
	_ rest.Lister               = (*configAccess)(nil)
	_ rest.Storage              = (*configAccess)(nil)
)

type configAccess struct {
	resourceInfo   apis.ResourceInfo
	tableConverter rest.TableConvertor
	builder        *DSAPIBuilder
}

func (s *configAccess) New() runtime.Object {
	return s.resourceInfo.NewFunc()
}

func (s *configAccess) Destroy() {}

func (s *configAccess) NamespaceScoped() bool {
	return true
}

func (s *configAccess) GetSingularName() string {
	return s.resourceInfo.GetSingularName()
}

func (s *configAccess) ShortNames() []string {
	return s.resourceInfo.GetShortNames()
}

func (s *configAccess) NewList() runtime.Object {
	return s.resourceInfo.NewListFunc()
}

func (s *configAccess) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *configAccess) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	ds, err := s.builder.getDataSource(ctx, name)
	if err != nil {
		return nil, err
	}
	return s.asConfig(ds), nil
}

func (s *configAccess) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
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

func (s *configAccess) asConfig(ds *datasources.DataSource) *v0alpha1.DataSourceConfig {
	meta := kinds.GrafanaResourceMetadata{
		Name:              ds.UID,
		Namespace:         s.builder.namespacer(ds.OrgID),
		CreationTimestamp: metav1.NewTime(ds.Created),
		ResourceVersion:   fmt.Sprintf("%d", ds.Updated.UnixMilli()),
	}
	// TODO????
	// Is there a way to know that this is provisioned??
	// if yes, can set the origin info
	meta.SetOriginInfo(nil)

	meta.SetUpdatedTimestamp(&ds.Updated)
	return &v0alpha1.DataSourceConfig{
		TypeMeta:   s.resourceInfo.TypeMeta(),
		ObjectMeta: metav1.ObjectMeta(meta),
		Spec: v0alpha1.ConfigSpec{
			Name:     ds.Name,
			URL:      ds.URL,
			Access:   string(ds.Access),
			ReadOnly: ds.ReadOnly,
			User:     ds.User,
		},
		Secure: v0alpha1.SecureSpec{
			Password:          "****",
			BasicAuthPassword: "***",
			SecureJsonData: map[string]string{
				"xxx": "***",
			},
		},
	}
}

func (s *configAccess) Create(ctx context.Context,
	obj runtime.Object,
	createValidation rest.ValidateObjectFunc,
	options *metav1.CreateOptions,
) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	p, ok := obj.(*v0alpha1.DataSourceConfig)
	if !ok {
		return nil, fmt.Errorf("expected config?")
	}

	fmt.Printf("TODO, create... %v // %v\n", info, p)

	return nil, fmt.Errorf("not implemented yet")
}

func (s *configAccess) Update(ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	createValidation rest.ValidateObjectFunc,
	updateValidation rest.ValidateObjectUpdateFunc,
	forceAllowCreate bool,
	options *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}

	created := false
	old, err := s.Get(ctx, name, nil)
	if err != nil {
		return old, created, err
	}

	obj, err := objInfo.UpdatedObject(ctx, old)
	if err != nil {
		return old, created, err
	}
	p, ok := obj.(*v0alpha1.DataSourceConfig)
	if !ok {
		return nil, created, fmt.Errorf("expected playlist after update")
	}

	fmt.Printf("TODO, update... %v // %v\n", info, p)

	return nil, false, fmt.Errorf("not implemented yet")
}

// GracefulDeleter
func (s *configAccess) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	v, err := s.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return v, false, err // includes the not-found error
	}
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}
	p, ok := v.(*v0alpha1.DataSourceConfig)
	if !ok {
		return v, false, fmt.Errorf("expected a playlist response from Get")
	}
	err = s.builder.dsService.DeleteDataSource(ctx, &datasources.DeleteDataSourceCommand{
		UID:   name,
		OrgID: info.OrgID,
	})
	return p, true, err // true is instant delete
}
