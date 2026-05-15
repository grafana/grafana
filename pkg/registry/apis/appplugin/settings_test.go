package appplugin

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
)

func newTestStorage(plugins map[string]*pluginsettings.DTO) *settingsStorage {
	ri := apppluginV0.SettingsResourceInfo.WithGroupAndShortName("test-app", "test-app")
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
	obj, err := storage.Get(ctx, "instance", nil)
	require.NoError(t, err)

	settings := obj.(*apppluginV0.Settings)
	require.Equal(t, "instance", settings.Name)
	require.Equal(t, "default", settings.Namespace)
	require.Equal(t, getLegacySettingsUID(1, "test-app"), settings.UID)
	require.Equal(t, getLegacySettingsResourceVersion(nil), settings.ResourceVersion)
	require.Nil(t, settings.Spec.Object)
}

func TestSettingsGet_WithPersistedSettings(t *testing.T) {
	updated := time.Unix(123, 456)
	storage := newTestStorage(map[string]*pluginsettings.DTO{
		"test-app": {
			ID:       7,
			PluginID: "test-app",
			OrgID:    1,
			Enabled:  true,
			Pinned:   true,
			JSONData: map[string]any{"apiUrl": "https://api.example.com", "timeout": float64(30)},
			Updated:  updated,
		},
	})

	ctx := request.WithNamespace(context.Background(), "default")
	obj, err := storage.Get(ctx, "instance", nil)
	require.NoError(t, err)

	settings := obj.(*apppluginV0.Settings)
	require.Equal(t, getLegacySettingsUID(1, "test-app"), settings.UID)
	require.Equal(t, getLegacySettingsResourceVersion(&pluginsettings.DTO{
		PluginID: "test-app",
		OrgID:    1,
		Enabled:  true,
		Pinned:   true,
		JSONData: map[string]any{"apiUrl": "https://api.example.com", "timeout": float64(30)},
		Updated:  updated,
	}), settings.ResourceVersion)
	require.Equal(t, map[string]any{"apiUrl": "https://api.example.com", "timeout": float64(30)}, settings.Spec.Object)
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

	list := obj.(*apppluginV0.SettingsList)
	require.Len(t, list.Items, 1)
	require.Equal(t, "instance", list.Items[0].Name)
	require.Equal(t, map[string]any{"key": "value"}, list.Items[0].Spec.Object)
}

func TestSettingsCreate(t *testing.T) {
	storage := newTestStorage(map[string]*pluginsettings.DTO{})

	ctx := request.WithNamespace(context.Background(), "default")
	input := &apppluginV0.Settings{
		ObjectMeta: metav1.ObjectMeta{Name: "instance", Namespace: "default"},
		Spec: apppluginV0.SettingsSpec{
			Unstructured: v0alpha1.Unstructured{
				Object: map[string]any{
					"Hello": "world",
				},
			},
		},
	}

	obj, err := storage.Create(ctx, input, nil, nil)
	require.NoError(t, err)

	settings := obj.(*apppluginV0.Settings)
	require.Equal(t, map[string]any{
		"Hello": "world",
	}, settings.Spec.Object)
}

func TestSettingsCreate_WithValidation(t *testing.T) {
	storage := newTestStorage(map[string]*pluginsettings.DTO{})

	ctx := request.WithNamespace(context.Background(), "default")
	input := &apppluginV0.Settings{
		ObjectMeta: metav1.ObjectMeta{Name: "instance", Namespace: "default"},
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
			JSONData: map[string]any{"A": "AA"},
		},
	})

	ctx := request.WithNamespace(context.Background(), "default")

	updater := rest.DefaultUpdatedObjectInfo(
		&apppluginV0.Settings{
			ObjectMeta: metav1.ObjectMeta{Name: "instance", Namespace: "default"},
			Spec: apppluginV0.SettingsSpec{
				Unstructured: v0alpha1.Unstructured{
					Object: map[string]any{"X": "YY"},
				},
			},
		},
	)

	obj, created, err := storage.Update(ctx, "instance", updater, nil, nil, false, nil)
	require.NoError(t, err)
	require.False(t, created)

	settings := obj.(*apppluginV0.Settings)
	require.Equal(t, map[string]any{"X": "YY"}, settings.Spec.Object)
}

func TestSettingsDelete_Noop(t *testing.T) {
	storage := newTestStorage(map[string]*pluginsettings.DTO{})

	ctx := request.WithNamespace(context.Background(), "default")
	obj, deleted, err := storage.Delete(ctx, "instance", nil, nil)
	require.Error(t, err)
	require.Nil(t, obj)
	require.False(t, deleted)
}

func TestSettingsDeleteCollection_Noop(t *testing.T) {
	storage := newTestStorage(map[string]*pluginsettings.DTO{})

	ctx := request.WithNamespace(context.Background(), "default")
	obj, err := storage.DeleteCollection(ctx, nil, nil, nil)
	require.Error(t, err)
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
	obj, err := storage.Get(ctx, "instance", nil)
	require.NoError(t, err)

	table, err := storage.ConvertToTable(ctx, obj, &metav1.TableOptions{})
	require.NoError(t, err)
	require.Len(t, table.Rows, 1)
}
