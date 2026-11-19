package appsettings

import (
	"context"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

// autoEnabledStorage serves default settings for an auto-enabled app that has
// nothing stored yet. Only enabled apps have settings, and an auto-enabled app is
// always enabled, so it must always have a settings object.
type autoEnabledStorage struct {
	grafanarest.Storage
	pluginID string
}

func (s *autoEnabledStorage) defaultSettings(ctx context.Context) (*apppluginV0.Settings, error) {
	nsInfo, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	return &apppluginV0.Settings{
		ObjectMeta: metav1.ObjectMeta{
			Name:      apppluginV0.INSTANCE_NAME,
			Namespace: nsInfo.Value,
			// The patch handler treats an object without a UID as not persisted and
			// rejects JSON patches against it, so use the same UID as the legacy store.
			UID: getLegacySettingsUID(nsInfo.OrgID, s.pluginID),
			// Matches the legacy store: "0" means nothing has been stored. Clients
			// send it back in a JSON patch resourceVersion test, so it must be set.
			ResourceVersion: "0",
		},
		Spec: common.Unstructured{Object: map[string]any{}},
	}, nil
}

func (s *autoEnabledStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	obj, err := s.Storage.Get(ctx, name, options)
	if name == apppluginV0.INSTANCE_NAME && apierrors.IsNotFound(err) {
		return s.defaultSettings(ctx)
	}
	return obj, err
}

func (s *autoEnabledStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	obj, err := s.Storage.List(ctx, options)
	if err != nil {
		return obj, err
	}
	list, ok := obj.(*apppluginV0.SettingsList)
	if !ok || len(list.Items) > 0 || hasSelector(options) {
		return obj, nil
	}
	settings, err := s.defaultSettings(ctx)
	if err != nil {
		return nil, err
	}
	list.Items = append(list.Items, *settings)
	return list, nil
}

func hasSelector(options *internalversion.ListOptions) bool {
	if options == nil {
		return false
	}
	return (options.LabelSelector != nil && !options.LabelSelector.Empty()) ||
		(options.FieldSelector != nil && !options.FieldSelector.Empty())
}

// Update applies the change to the default settings and creates them when nothing
// is stored yet, so a PATCH against the object served by Get succeeds.
func (s *autoEnabledStorage) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	obj, created, err := s.Storage.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
	if name != apppluginV0.INSTANCE_NAME || !apierrors.IsNotFound(err) {
		return obj, created, err
	}

	existing, err := s.defaultSettings(ctx)
	if err != nil {
		return nil, false, err
	}
	updated, err := objInfo.UpdatedObject(ctx, existing)
	if err != nil {
		return nil, false, err
	}
	if updateValidation != nil {
		if err := updateValidation(ctx, updated, existing); err != nil {
			return nil, false, err
		}
	}
	accessor, err := meta.Accessor(updated)
	if err != nil {
		return nil, false, err
	}
	// Create rejects a resourceVersion and assigns its own UID.
	accessor.SetResourceVersion("")
	accessor.SetUID("")

	createOptions := &metav1.CreateOptions{}
	if options != nil {
		createOptions.DryRun = options.DryRun
		createOptions.FieldManager = options.FieldManager
		createOptions.FieldValidation = options.FieldValidation
	}
	obj, err = s.Create(ctx, updated, createValidation, createOptions)
	return obj, err == nil, err
}
