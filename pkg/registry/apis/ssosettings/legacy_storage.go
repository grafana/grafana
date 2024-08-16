package ssosettings

import (
	"context"
	"errors"
	"fmt"

	commonv1 "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apiserver/pkg/registry/rest"

	ssov0 "github.com/grafana/grafana/pkg/apis/ssosettings/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	ssomodels "github.com/grafana/grafana/pkg/services/ssosettings/models"
)

var (
	_ rest.Storage              = (*legacyStorage)(nil)
	_ rest.Scoper               = (*legacyStorage)(nil)
	_ rest.Getter               = (*legacyStorage)(nil)
	_ rest.Lister               = (*legacyStorage)(nil)
	_ rest.SingularNameProvider = (*legacyStorage)(nil)
)

var resource = ssov0.SSOSettingResourceInfo

func newLegacyStore(service ssosettings.Service) *legacyStorage {
	return &legacyStorage{service}
}

type legacyStorage struct {
	service ssosettings.Service
}

// Destroy implements rest.Storage.
func (s *legacyStorage) Destroy() {}

// NamespaceScoped implements rest.Scoper.
func (s *legacyStorage) NamespaceScoped() bool {
	// this is maybe incorrect
	return true
}

// New implements rest.Storage.
func (s *legacyStorage) New() runtime.Object {
	return resource.NewFunc()
}

// ConvertToTable implements rest.Lister.
func (s *legacyStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return resource.TableConverter().ConvertToTable(ctx, object, tableOptions)
}

// NewList implements rest.Lister.
func (s *legacyStorage) NewList() runtime.Object {
	return resource.NewListFunc()
}

// List implements rest.Lister.
func (s *legacyStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	ns, _ := request.NamespaceInfoFrom(ctx, false)

	settings, err := s.service.List(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list sso settings: %w", err)
	}

	list := &ssov0.SSOSettingList{}
	for _, s := range settings {
		list.Items = append(list.Items, mapToObject(ns.Value, s))
	}

	return list, nil
}

// Get implements rest.Getter.
func (s *legacyStorage) Get(ctx context.Context, name string, options *v1.GetOptions) (runtime.Object, error) {
	ns, _ := request.NamespaceInfoFrom(ctx, false)

	setting, err := s.service.GetForProviderWithRedactedSecrets(ctx, name)
	if err != nil {
		if errors.Is(err, ssosettings.ErrNotFound) {
			return nil, resource.NewNotFound(name)
		}
	}

	object := mapToObject(ns.Value, setting)
	return &object, nil
}

// GetSingularName implements rest.SingularNameProvider.
func (s *legacyStorage) GetSingularName() string {
	return resource.GetSingularName()
}

func mapToObject(ns string, s *ssomodels.SSOSettings) ssov0.SSOSetting {
	source := ssov0.SourceDB
	if s.Source == ssomodels.System {
		source = ssov0.SourceSystem
	}

	version := "0"
	if !s.Updated.IsZero() {
		version = fmt.Sprintf("%d", s.Updated.UnixMilli())
	}

	object := ssov0.SSOSetting{
		ObjectMeta: v1.ObjectMeta{
			Name:              s.Provider,
			Namespace:         ns,
			UID:               types.UID(s.Provider),
			ResourceVersion:   version,
			CreationTimestamp: metav1.NewTime(s.Updated),
		},
		Spec: ssov0.Spec{
			Source:   source,
			Settings: commonv1.Unstructured{Object: s.Settings},
		},
	}

	return object
}
