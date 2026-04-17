package appplugin

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	apppluginv0alpha1 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
)

func newTestStorage(plugins map[string]*pluginsettings.DTO) *settingsStorage {
	ri := apppluginv0alpha1.SettingsResourceInfo.WithGroupAndShortName("test-app.grafana.app", "test-app")
	return &settingsStorage{
		pluginID:       "test-app",
		pluginSettings: &pluginsettings.FakePluginSettings{Plugins: plugins},
		resourceInfo:   &ri,
	}
}

func TestSettingsGet_InvalidName(t *testing.T) {
	storage := newTestStorage(map[string]*pluginsettings.DTO{})

	ctx := request.WithNamespace(context.Background(), "default")
	obj, err := storage.Get(ctx, "not-current", nil)
	require.Nil(t, obj)
	require.Error(t, err)
	require.True(t, apierrors.IsNotFound(err))
}

func TestSettingsGet_NoPersistedSettings(t *testing.T) {
	storage := newTestStorage(map[string]*pluginsettings.DTO{})

	ctx := request.WithNamespace(context.Background(), "default")
	obj, err := storage.Get(ctx, "test-app", nil)
	require.NoError(t, err)

	settings := obj.(*apppluginv0alpha1.Settings)
	require.Equal(t, "test-app", settings.Name)
	require.Equal(t, "default", settings.Namespace)
	require.False(t, settings.Spec.Enabled)
	require.False(t, settings.Spec.Pinned)
	require.Nil(t, settings.Spec.JsonData.Object)
}

func TestSettingsGet_WithPersistedSettings(t *testing.T) {
	storage := newTestStorage(map[string]*pluginsettings.DTO{
		"test-app": {
			PluginID: "test-app",
			OrgID:    1,
			Enabled:  true,
			Pinned:   true,
			JSONData: map[string]any{"apiUrl": "https://api.example.com", "timeout": float64(30)},
		},
	})

	ctx := request.WithNamespace(context.Background(), "default")
	obj, err := storage.Get(ctx, "test-app", nil)
	require.NoError(t, err)

	settings := obj.(*apppluginv0alpha1.Settings)
	require.True(t, settings.Spec.Enabled)
	require.True(t, settings.Spec.Pinned)
	require.Equal(t, map[string]any{"apiUrl": "https://api.example.com", "timeout": float64(30)}, settings.Spec.JsonData.Object)
}

func TestSettingsList(t *testing.T) {
	storage := newTestStorage(map[string]*pluginsettings.DTO{
		"test-app": {
			PluginID: "test-app",
			OrgID:    1,
			Enabled:  true,
			Pinned:   false,
			JSONData: map[string]any{"key": "value"},
		},
	})

	ctx := request.WithNamespace(context.Background(), "default")
	obj, err := storage.List(ctx, nil)
	require.NoError(t, err)

	list := obj.(*apppluginv0alpha1.SettingsList)
	require.Len(t, list.Items, 1)
	require.Equal(t, "test-app", list.Items[0].Name)
	require.True(t, list.Items[0].Spec.Enabled)
	require.Equal(t, map[string]any{"key": "value"}, list.Items[0].Spec.JsonData.Object)
}

func TestSettingsCreate(t *testing.T) {
	storage := newTestStorage(map[string]*pluginsettings.DTO{})

	ctx := request.WithNamespace(context.Background(), "default")
	input := &apppluginv0alpha1.Settings{
		ObjectMeta: metav1.ObjectMeta{Name: "test-app", Namespace: "default"},
		Spec: apppluginv0alpha1.SettingsSpec{
			Enabled: true,
			Pinned:  true,
		},
	}

	obj, err := storage.Create(ctx, input, nil, nil)
	require.NoError(t, err)

	settings := obj.(*apppluginv0alpha1.Settings)
	require.True(t, settings.Spec.Enabled)
	require.True(t, settings.Spec.Pinned)
}

func TestSettingsCreate_WithValidation(t *testing.T) {
	storage := newTestStorage(map[string]*pluginsettings.DTO{})

	ctx := request.WithNamespace(context.Background(), "default")
	input := &apppluginv0alpha1.Settings{
		ObjectMeta: metav1.ObjectMeta{Name: "test-app", Namespace: "default"},
	}

	validationErr := apierrors.NewBadRequest("validation failed")
	validator := func(_ context.Context, _ runtime.Object) error {
		return validationErr
	}

	obj, err := storage.Create(ctx, input, validator, nil)
	require.Nil(t, obj)
	require.ErrorIs(t, err, validationErr)
}

func TestSettingsUpdate(t *testing.T) {
	storage := newTestStorage(map[string]*pluginsettings.DTO{
		"test-app": {
			PluginID: "test-app",
			OrgID:    1,
			Enabled:  true,
			Pinned:   false,
		},
	})

	ctx := request.WithNamespace(context.Background(), "default")

	updater := rest.DefaultUpdatedObjectInfo(
		&apppluginv0alpha1.Settings{
			ObjectMeta: metav1.ObjectMeta{Name: "test-app", Namespace: "default"},
			Spec: apppluginv0alpha1.SettingsSpec{
				Enabled: false,
				Pinned:  true,
			},
		},
	)

	obj, created, err := storage.Update(ctx, "test-app", updater, nil, nil, false, nil)
	require.NoError(t, err)
	require.False(t, created)

	settings := obj.(*apppluginv0alpha1.Settings)
	require.False(t, settings.Spec.Enabled)
	require.True(t, settings.Spec.Pinned)
}

func TestSettingsDelete_Noop(t *testing.T) {
	storage := newTestStorage(map[string]*pluginsettings.DTO{})

	ctx := request.WithNamespace(context.Background(), "default")
	obj, deleted, err := storage.Delete(ctx, "test-app", nil, nil)
	require.NoError(t, err)
	require.Nil(t, obj)
	require.False(t, deleted)
}

func TestSettingsDeleteCollection_Noop(t *testing.T) {
	storage := newTestStorage(map[string]*pluginsettings.DTO{})

	ctx := request.WithNamespace(context.Background(), "default")
	obj, err := storage.DeleteCollection(ctx, nil, nil, nil)
	require.NoError(t, err)
	require.Nil(t, obj)
}

func TestSettingsConvertToTable(t *testing.T) {
	storage := newTestStorage(map[string]*pluginsettings.DTO{
		"test-app": {
			PluginID: "test-app",
			OrgID:    1,
			Enabled:  true,
		},
	})

	ctx := request.WithNamespace(context.Background(), "default")
	obj, err := storage.Get(ctx, "test-app", nil)
	require.NoError(t, err)

	table, err := storage.ConvertToTable(ctx, obj, &metav1.TableOptions{})
	require.NoError(t, err)
	require.Len(t, table.Rows, 1)
}
