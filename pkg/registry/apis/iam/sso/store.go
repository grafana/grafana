package sso

import (
	"context"
	"errors"
	"fmt"

	commonv1 "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apiserver/pkg/registry/rest"

	iamv0 "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	ssomodels "github.com/grafana/grafana/pkg/services/ssosettings/models"
)

var (
	_ rest.Storage              = (*LegacyStore)(nil)
	_ rest.Scoper               = (*LegacyStore)(nil)
	_ rest.Getter               = (*LegacyStore)(nil)
	_ rest.Lister               = (*LegacyStore)(nil)
	_ rest.Updater              = (*LegacyStore)(nil)
	_ rest.SingularNameProvider = (*LegacyStore)(nil)
	_ rest.GracefulDeleter      = (*LegacyStore)(nil)
)

var resource = iamv0.SSOSettingResourceInfo

func NewLegacyStore(service ssosettings.Service) *LegacyStore {
	return &LegacyStore{service}
}

type LegacyStore struct {
	service ssosettings.Service
}

// Destroy implements rest.Storage.
func (s *LegacyStore) Destroy() {}

// NamespaceScoped implements rest.Scoper.
func (s *LegacyStore) NamespaceScoped() bool {
	// this is maybe incorrect
	return true
}

// GetSingularName implements rest.SingularNameProvider.
func (s *LegacyStore) GetSingularName() string {
	return resource.GetSingularName()
}

// New implements rest.Storage.
func (s *LegacyStore) New() runtime.Object {
	return resource.NewFunc()
}

// ConvertToTable implements rest.Lister.
func (s *LegacyStore) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return resource.TableConverter().ConvertToTable(ctx, object, tableOptions)
}

// NewList implements rest.Lister.
func (s *LegacyStore) NewList() runtime.Object {
	return resource.NewListFunc()
}

// List implements rest.Lister.
func (s *LegacyStore) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	ns, _ := request.NamespaceInfoFrom(ctx, false)

	settings, err := s.service.List(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list sso settings: %w", err)
	}

	list := &iamv0.SSOSettingList{}
	for _, s := range settings {
		list.Items = append(list.Items, mapToObject(ns.Value, s))
	}

	return list, nil
}

// Get implements rest.Getter.
func (s *LegacyStore) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	ns, _ := request.NamespaceInfoFrom(ctx, false)

	setting, err := s.service.GetForProviderWithRedactedSecrets(ctx, name)
	if err != nil {
		if errors.Is(err, ssosettings.ErrNotFound) {
			return nil, resource.NewNotFound(name)
		}
		return nil, err
	}

	object := mapToObject(ns.Value, setting)
	return &object, nil
}

// Update implements rest.Updater.
func (s *LegacyStore) Update(
	ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	_ rest.ValidateObjectFunc,
	_ rest.ValidateObjectUpdateFunc,
	_ bool,
	_ *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	const created = false
	ident, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, created, err
	}

	old, err := s.Get(ctx, name, nil)
	if err != nil {
		return old, created, err
	}

	obj, err := objInfo.UpdatedObject(ctx, old)
	if err != nil {
		return old, created, err
	}

	setting, ok := obj.(*iamv0.SSOSetting)
	if !ok {
		return old, created, errors.New("expected ssosetting after update")
	}

	if err := s.service.Upsert(ctx, mapToModel(setting), ident); err != nil {
		return old, created, err
	}

	updated, err := s.Get(ctx, name, nil)
	return updated, created, err
}

// Delete implements rest.GracefulDeleter.
func (s *LegacyStore) Delete(
	ctx context.Context,
	name string,
	_ rest.ValidateObjectFunc,
	options *metav1.DeleteOptions,
) (runtime.Object, bool, error) {
	obj, err := s.Get(ctx, name, nil)
	if err != nil {
		return obj, false, err
	}

	old, ok := obj.(*iamv0.SSOSetting)
	if !ok {
		return obj, false, errors.New("expected ssosetting")
	}

	// FIXME(kalleep): this should probably be validated in transaction
	if options.Preconditions != nil && options.Preconditions.ResourceVersion != nil {
		if *options.Preconditions.ResourceVersion != old.GetResourceVersion() {
			return old, false, apierrors.NewConflict(
				resource.GroupResource(),
				name,
				fmt.Errorf(
					"the ResourceVersion in the precondition (%s) does not match the ResourceVersion in record (%s). The object might have been modified",
					*options.Preconditions.ResourceVersion,
					old.GetResourceVersion(),
				),
			)
		}
	}

	if err := s.service.Delete(ctx, name); err != nil {
		return old, false, err
	}

	// If settings for a provider is deleted from db they will fallback to settings from config file, env or arguments.
	afterDelete, err := s.Get(ctx, name, nil)
	return afterDelete, false, err
}

func mapToObject(ns string, s *ssomodels.SSOSettings) iamv0.SSOSetting {
	source := iamv0.SourceDB
	if s.Source == ssomodels.System {
		source = iamv0.SourceSystem
	}

	version := "0"
	if !s.Updated.IsZero() {
		version = fmt.Sprintf("%d", s.Updated.UnixMilli())
	}

	object := iamv0.SSOSetting{
		ObjectMeta: metav1.ObjectMeta{
			Name:              s.Provider,
			Namespace:         ns,
			UID:               types.UID(s.Provider),
			ResourceVersion:   version,
			CreationTimestamp: metav1.NewTime(s.Updated),
		},
		Spec: iamv0.SSOSettingSpec{
			Source:   source,
			Settings: commonv1.Unstructured{Object: s.Settings},
		},
	}

	return object
}

func mapToModel(obj *iamv0.SSOSetting) *ssomodels.SSOSettings {
	return &ssomodels.SSOSettings{
		Provider: obj.Name,
		Settings: obj.Spec.Settings.Object,
	}
}
