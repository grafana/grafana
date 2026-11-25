package appsettings

import (
	"context"

	metainternal "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
)

// Only expose read interfaces to Kubernetes so writes and watches are neither
// installed nor advertised, even if the underlying store implements them.
type readOnlyStorage struct {
	store grafanarest.Storage
}

func (s readOnlyStorage) New() runtime.Object     { return s.store.New() }
func (s readOnlyStorage) NewList() runtime.Object { return s.store.NewList() }
func (s readOnlyStorage) Destroy()                { s.store.Destroy() }
func (s readOnlyStorage) NamespaceScoped() bool   { return s.store.NamespaceScoped() }
func (s readOnlyStorage) GetSingularName() string { return s.store.GetSingularName() }
func (s readOnlyStorage) Get(ctx context.Context, name string, opts *metav1.GetOptions) (runtime.Object, error) {
	return s.store.Get(ctx, name, opts)
}
func (s readOnlyStorage) List(ctx context.Context, opts *metainternal.ListOptions) (runtime.Object, error) {
	return s.store.List(ctx, opts)
}
func (s readOnlyStorage) ConvertToTable(ctx context.Context, obj runtime.Object, opts runtime.Object) (*metav1.Table, error) {
	return s.store.ConvertToTable(ctx, obj, opts)
}
