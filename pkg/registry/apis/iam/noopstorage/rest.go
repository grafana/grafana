package noopstorage

import (
	"context"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

type NoopREST struct {
	ResourceInfo utils.ResourceInfo
}

var (
	_ rest.Storage              = (*NoopREST)(nil)
	_ rest.Scoper               = (*NoopREST)(nil)
	_ rest.SingularNameProvider = (*NoopREST)(nil)
	_ rest.Getter               = (*NoopREST)(nil)
)

func (n *NoopREST) New() runtime.Object {
	return n.ResourceInfo.NewFunc()
}

func (n *NoopREST) NewList() runtime.Object {
	return n.ResourceInfo.NewListFunc()
}

func (n *NoopREST) NamespaceScoped() bool {
	return true
}

func (n *NoopREST) GetSingularName() string {
	return n.ResourceInfo.GetSingularName()
}

func (n *NoopREST) Destroy() {}

func (n *NoopREST) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	return nil, errNoopStorage
}

func (n *NoopREST) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	return nil, errNoopStorage
}

func (n *NoopREST) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	return nil, errNoopStorage
}

func (n *NoopREST) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	return nil, false, errNoopStorage
}

func (n *NoopREST) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	return nil, false, errNoopStorage
}

func (n *NoopREST) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return nil, errNoopStorage
}

func (n *NoopREST) Watch(ctx context.Context, options *internalversion.ListOptions) (watch.Interface, error) {
	return nil, errNoopStorage
}

func (n *NoopREST) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return nil, errNoopStorage
}
