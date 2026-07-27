package sso

import (
	"context"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
)

var (
	_ rest.Storage              = (*MTSettingsStore)(nil)
	_ rest.Scoper               = (*MTSettingsStore)(nil)
	_ rest.Getter               = (*MTSettingsStore)(nil)
	_ rest.Lister               = (*MTSettingsStore)(nil)
	_ rest.Updater              = (*MTSettingsStore)(nil)
	_ rest.SingularNameProvider = (*MTSettingsStore)(nil)
	_ rest.GracefulDeleter      = (*MTSettingsStore)(nil)
)

// MTSettingsStore is the MT-Settings-backed storage for the SSOSetting kind
// and the "unified" side of the resource's dual-writer. At storage mode 0 the
// dual-writer serves the legacy store and this one is never reached; at any
// higher mode it fails loudly until the MT-Settings pipes are implemented.
type MTSettingsStore struct{}

func NewMTSettingsStore() *MTSettingsStore {
	return &MTSettingsStore{}
}

// Destroy implements rest.Storage.
func (s *MTSettingsStore) Destroy() {}

// NamespaceScoped implements rest.Scoper.
func (s *MTSettingsStore) NamespaceScoped() bool {
	return true
}

// GetSingularName implements rest.SingularNameProvider.
func (s *MTSettingsStore) GetSingularName() string {
	return resource.GetSingularName()
}

// New implements rest.Storage.
func (s *MTSettingsStore) New() runtime.Object {
	return resource.NewFunc()
}

// NewList implements rest.Lister.
func (s *MTSettingsStore) NewList() runtime.Object {
	return resource.NewListFunc()
}

// ConvertToTable implements rest.Lister.
func (s *MTSettingsStore) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return resource.TableConverter().ConvertToTable(ctx, object, tableOptions)
}

// Get implements rest.Getter.
func (s *MTSettingsStore) Get(_ context.Context, name string, _ *metav1.GetOptions) (runtime.Object, error) {
	return nil, s.notImplemented("get", name)
}

// List implements rest.Lister.
func (s *MTSettingsStore) List(_ context.Context, _ *internalversion.ListOptions) (runtime.Object, error) {
	return nil, s.notImplemented("list", "")
}

// Update implements rest.Updater.
func (s *MTSettingsStore) Update(_ context.Context, name string, _ rest.UpdatedObjectInfo, _ rest.ValidateObjectFunc, _ rest.ValidateObjectUpdateFunc, _ bool, _ *metav1.UpdateOptions) (runtime.Object, bool, error) {
	return nil, false, s.notImplemented("update", name)
}

// Delete implements rest.GracefulDeleter.
func (s *MTSettingsStore) Delete(_ context.Context, name string, _ rest.ValidateObjectFunc, _ *metav1.DeleteOptions) (runtime.Object, bool, error) {
	return nil, false, s.notImplemented("delete", name)
}

func (s *MTSettingsStore) notImplemented(verb string, name string) error {
	return apierrors.NewGenericServerResponse(http.StatusNotImplemented, verb, resource.GroupResource(), name,
		"MT-Settings storage for SSO settings is not implemented yet", 0, false)
}
