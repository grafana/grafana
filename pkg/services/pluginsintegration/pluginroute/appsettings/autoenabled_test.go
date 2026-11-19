package appsettings

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
)

// emptyStore behaves like unified storage before any settings are written.
type emptyStore struct {
	grafanarest.Storage
	stored    *apppluginV0.Settings
	updateErr error
	created   []*apppluginV0.Settings
}

func (s *emptyStore) notFound(name string) error {
	return apierrors.NewNotFound(apppluginV0.SettingsResourceInfo.GroupResource(), name)
}

func (s *emptyStore) Get(_ context.Context, name string, _ *metav1.GetOptions) (runtime.Object, error) {
	if s.stored == nil {
		return nil, s.notFound(name)
	}
	return s.stored, nil
}

func (s *emptyStore) List(_ context.Context, _ *internalversion.ListOptions) (runtime.Object, error) {
	list := &apppluginV0.SettingsList{}
	if s.stored != nil {
		list.Items = append(list.Items, *s.stored)
	}
	return list, nil
}

func (s *emptyStore) Update(_ context.Context, name string, _ rest.UpdatedObjectInfo, _ rest.ValidateObjectFunc, _ rest.ValidateObjectUpdateFunc, _ bool, _ *metav1.UpdateOptions) (runtime.Object, bool, error) {
	if s.updateErr != nil {
		return nil, false, s.updateErr
	}
	return nil, false, s.notFound(name)
}

func (s *emptyStore) Create(_ context.Context, obj runtime.Object, _ rest.ValidateObjectFunc, _ *metav1.CreateOptions) (runtime.Object, error) {
	settings := obj.(*apppluginV0.Settings)
	s.created = append(s.created, settings)
	return settings, nil
}

func autoEnabledCtx() context.Context {
	return request.WithNamespace(context.Background(), "default")
}

func TestAutoEnabledStorage_Get(t *testing.T) {
	t.Run("returns default settings when nothing is stored", func(t *testing.T) {
		store := &autoEnabledStorage{Storage: &emptyStore{}, pluginID: "test-app"}

		obj, err := store.Get(autoEnabledCtx(), apppluginV0.INSTANCE_NAME, nil)
		require.NoError(t, err)

		settings := obj.(*apppluginV0.Settings)
		require.Equal(t, apppluginV0.INSTANCE_NAME, settings.Name)
		require.Equal(t, "default", settings.Namespace)
		require.Equal(t, "0", settings.ResourceVersion)
		require.Equal(t, getLegacySettingsUID(1, "test-app"), settings.UID, "patching needs the object to look persisted")
		require.Equal(t, map[string]any{}, settings.Spec.Object)
	})

	t.Run("returns stored settings", func(t *testing.T) {
		stored := &apppluginV0.Settings{
			ObjectMeta: metav1.ObjectMeta{Name: apppluginV0.INSTANCE_NAME, ResourceVersion: "42"},
			Spec:       common.Unstructured{Object: map[string]any{"url": "https://api.example.com"}},
		}
		store := &autoEnabledStorage{Storage: &emptyStore{stored: stored}, pluginID: "test-app"}

		obj, err := store.Get(autoEnabledCtx(), apppluginV0.INSTANCE_NAME, nil)
		require.NoError(t, err)
		require.Same(t, stored, obj)
	})

	t.Run("keeps not found for other names", func(t *testing.T) {
		store := &autoEnabledStorage{Storage: &emptyStore{}, pluginID: "test-app"}

		_, err := store.Get(autoEnabledCtx(), "other", nil)
		require.True(t, apierrors.IsNotFound(err))
	})
}

func TestAutoEnabledStorage_List(t *testing.T) {
	t.Run("lists default settings when nothing is stored", func(t *testing.T) {
		store := &autoEnabledStorage{Storage: &emptyStore{}, pluginID: "test-app"}

		obj, err := store.List(autoEnabledCtx(), nil)
		require.NoError(t, err)

		list := obj.(*apppluginV0.SettingsList)
		require.Len(t, list.Items, 1)
		require.Equal(t, apppluginV0.INSTANCE_NAME, list.Items[0].Name)
	})

	t.Run("does not add defaults to a filtered list", func(t *testing.T) {
		store := &autoEnabledStorage{Storage: &emptyStore{}, pluginID: "test-app"}

		for name, opts := range map[string]*internalversion.ListOptions{
			"label": {LabelSelector: labels.SelectorFromSet(labels.Set{"a": "b"})},
			"field": {FieldSelector: fields.OneTermEqualSelector("metadata.name", "other")},
		} {
			t.Run(name, func(t *testing.T) {
				obj, err := store.List(autoEnabledCtx(), opts)
				require.NoError(t, err)
				require.Empty(t, obj.(*apppluginV0.SettingsList).Items)
			})
		}
	})
}

func TestAutoEnabledStorage_Update(t *testing.T) {
	t.Run("creates settings from the default when nothing is stored", func(t *testing.T) {
		inner := &emptyStore{}
		store := &autoEnabledStorage{Storage: inner, pluginID: "test-app"}

		var seenExisting *apppluginV0.Settings
		objInfo := rest.DefaultUpdatedObjectInfo(nil, func(_ context.Context, newObj, oldObj runtime.Object) (runtime.Object, error) {
			seenExisting = oldObj.(*apppluginV0.Settings)
			updated := seenExisting.DeepCopy()
			updated.Spec = common.Unstructured{Object: map[string]any{"url": "https://api.example.com"}}
			return updated, nil
		})

		obj, created, err := store.Update(autoEnabledCtx(), apppluginV0.INSTANCE_NAME, objInfo, nil, nil, false, nil)
		require.NoError(t, err)
		require.True(t, created)
		require.Equal(t, "0", seenExisting.ResourceVersion, "the patch is applied to the object Get serves")

		require.Len(t, inner.created, 1)
		require.Empty(t, inner.created[0].ResourceVersion, "create rejects a resourceVersion")
		require.Empty(t, inner.created[0].UID, "create assigns the UID")
		require.Equal(t, map[string]any{"url": "https://api.example.com"}, obj.(*apppluginV0.Settings).Spec.Object)
	})

	t.Run("runs update validation against the default", func(t *testing.T) {
		inner := &emptyStore{}
		store := &autoEnabledStorage{Storage: inner, pluginID: "test-app"}
		validationErr := apierrors.NewForbidden(apppluginV0.SettingsResourceInfo.GroupResource(), apppluginV0.INSTANCE_NAME, errors.New("nope"))

		_, _, err := store.Update(autoEnabledCtx(), apppluginV0.INSTANCE_NAME,
			rest.DefaultUpdatedObjectInfo(&apppluginV0.Settings{ObjectMeta: metav1.ObjectMeta{Name: apppluginV0.INSTANCE_NAME}}),
			nil, func(context.Context, runtime.Object, runtime.Object) error { return validationErr }, false, nil)
		require.ErrorIs(t, err, validationErr)
		require.Empty(t, inner.created)
	})

	t.Run("passes through other errors", func(t *testing.T) {
		updateErr := apierrors.NewConflict(apppluginV0.SettingsResourceInfo.GroupResource(), apppluginV0.INSTANCE_NAME, errors.New("conflict"))
		inner := &emptyStore{updateErr: updateErr}
		store := &autoEnabledStorage{Storage: inner, pluginID: "test-app"}

		_, _, err := store.Update(autoEnabledCtx(), apppluginV0.INSTANCE_NAME, rest.DefaultUpdatedObjectInfo(&apppluginV0.Settings{}), nil, nil, false, nil)
		require.ErrorIs(t, err, updateErr)
		require.Empty(t, inner.created)
	})
}
