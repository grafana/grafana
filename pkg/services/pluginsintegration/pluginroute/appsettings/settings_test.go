package appsettings

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
)

func newTestStorage(plugins map[string]*pluginsettings.DTO) *settingsStorage {
	return NewLegacySettingsStore("test-app", "test-app", &pluginsettings.FakePluginSettings{Plugins: plugins}).(*settingsStorage)
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
	require.False(t, settings.Spec.Enabled)
	require.Nil(t, settings.Spec.JsonData.Object)
}

func TestSettingsGet_WithPersistedSettings(t *testing.T) {
	updated := time.Unix(123, 456)
	storage := newTestStorage(map[string]*pluginsettings.DTO{
		"test-app": {
			ID:       7,
			PluginID: "test-app",
			OrgID:    1,
			Enabled:  true,
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
		JSONData: map[string]any{"apiUrl": "https://api.example.com", "timeout": float64(30)},
		Updated:  updated,
	}), settings.ResourceVersion)
	require.True(t, settings.Spec.Enabled)
	require.Equal(t, map[string]any{"apiUrl": "https://api.example.com", "timeout": float64(30)}, settings.Spec.JsonData.Object)
}

func TestSettingsList(t *testing.T) {
	storage := newTestStorage(map[string]*pluginsettings.DTO{
		"test-app": {
			PluginID: "test-app",
			OrgID:    1,
			Enabled:  true,
			JSONData: map[string]any{"key": "value"},
		},
	})

	ctx := request.WithNamespace(context.Background(), "default")
	obj, err := storage.List(ctx, nil)
	require.NoError(t, err)

	list := obj.(*apppluginV0.SettingsList)
	require.Len(t, list.Items, 1)
	require.Equal(t, "instance", list.Items[0].Name)
	require.True(t, list.Items[0].Spec.Enabled)
	require.Equal(t, map[string]any{"key": "value"}, list.Items[0].Spec.JsonData.Object)
}

func TestSettingsListOptions(t *testing.T) {
	for _, persisted := range []bool{false, true} {
		name, version := "default settings", "0"
		settings := map[string]*pluginsettings.DTO{}
		if persisted {
			name, version = "persisted settings", "123"
			settings["test-app"] = &pluginsettings.DTO{Enabled: true, Updated: time.UnixMilli(123)}
		}
		t.Run(name, func(t *testing.T) {
			for mode, store := range map[string]grafanarest.Storage{
				"read-write": newTestStorage(settings),
				"read-only":  NewReadOnlyLegacySettingsStore("test-app", readOnlySettings{settings}),
			} {
				t.Run(mode, func(t *testing.T) {
					for _, tc := range []struct {
						name string
						opts *internalversion.ListOptions
						want int
					}{
						{name: "no options", want: 1},
						{name: "matching name", opts: &internalversion.ListOptions{FieldSelector: fields.OneTermEqualSelector("metadata.name", "instance")}, want: 1},
						{name: "other name", opts: &internalversion.ListOptions{FieldSelector: fields.OneTermEqualSelector("metadata.name", "other")}},
						{name: "matching namespace", opts: &internalversion.ListOptions{FieldSelector: fields.OneTermEqualSelector("metadata.namespace", "default")}, want: 1},
						{name: "other namespace", opts: &internalversion.ListOptions{FieldSelector: fields.OneTermEqualSelector("metadata.namespace", "other")}},
						{name: "missing label", opts: &internalversion.ListOptions{LabelSelector: labels.SelectorFromSet(labels.Set{"missing": "value"})}},
						{name: "all labels", opts: &internalversion.ListOptions{LabelSelector: labels.Everything()}, want: 1},
						{name: "singleton limit", opts: &internalversion.ListOptions{Limit: 1}, want: 1},
					} {
						t.Run(tc.name, func(t *testing.T) {
							obj, err := store.List(request.WithNamespace(t.Context(), "default"), tc.opts)
							require.NoError(t, err)
							list := obj.(*apppluginV0.SettingsList)
							require.NotNil(t, list.Items)
							require.Len(t, list.Items, tc.want)
							require.Equal(t, version, list.ResourceVersion)
							require.Empty(t, list.Continue)
						})
					}
				})
			}
		})
	}
}

func TestSettingsListRejectsUnsupportedOptionsBeforeReading(t *testing.T) {
	store := NewReadOnlyLegacySettingsStore("test-app", failingSettings{errors.New("unexpected storage read")})
	for name, opts := range map[string]*internalversion.ListOptions{
		"continue":            {Continue: "token"},
		"spec field selector": {FieldSelector: fields.OneTermEqualSelector("spec.enabled", "true")},
		"mixed field selector": {FieldSelector: fields.AndSelectors(
			fields.OneTermEqualSelector("metadata.name", "instance"),
			fields.OneTermEqualSelector("metadata.uid", "x"),
		)},
	} {
		t.Run(name, func(t *testing.T) {
			obj, err := store.List(request.WithNamespace(t.Context(), "default"), opts)
			require.Nil(t, obj)
			require.True(t, apierrors.IsBadRequest(err), err)
		})
	}
}

func TestSettingsCreate(t *testing.T) {
	storage := newTestStorage(map[string]*pluginsettings.DTO{})

	ctx := request.WithNamespace(context.Background(), "default")
	input := &apppluginV0.Settings{
		ObjectMeta: metav1.ObjectMeta{Name: "instance", Namespace: "default"},
		Spec: apppluginV0.SettingsSpec{
			Enabled: true,
		},
	}

	obj, err := storage.Create(ctx, input, nil, nil)
	require.NoError(t, err)

	settings := obj.(*apppluginV0.Settings)
	require.True(t, settings.Spec.Enabled)
}

func TestSettingsCreate_JSONDataTooLarge(t *testing.T) {
	storage := newTestStorage(map[string]*pluginsettings.DTO{})
	storage.pluginSettings = &pluginsettings.FakePluginSettings{
		UpdateErr: pluginsettings.ErrPluginSettingDataTooLarge.Errorf("too large"),
	}

	ctx := request.WithNamespace(context.Background(), "default")
	input := &apppluginV0.Settings{ObjectMeta: metav1.ObjectMeta{Name: "instance", Namespace: "default"}}

	_, err := storage.Create(ctx, input, nil, nil)
	require.True(t, apierrors.IsBadRequest(err))
}

func TestSettingsCreate_DryRunDoesNotPersist(t *testing.T) {
	plugins := map[string]*pluginsettings.DTO{}
	storage := newTestStorage(plugins)

	ctx := request.WithNamespace(context.Background(), "default")
	input := &apppluginV0.Settings{
		ObjectMeta: metav1.ObjectMeta{Name: "instance", Namespace: "default"},
		Spec: apppluginV0.SettingsSpec{
			Enabled: true,
		},
	}

	obj, err := storage.Create(ctx, input, nil, &metav1.CreateOptions{DryRun: []string{metav1.DryRunAll}})
	require.NoError(t, err)

	settings := obj.(*apppluginV0.Settings)
	require.True(t, settings.Spec.Enabled)
	require.Empty(t, plugins)
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
			Enabled:  true,
		},
	})

	ctx := request.WithNamespace(context.Background(), "default")

	updater := rest.DefaultUpdatedObjectInfo(
		&apppluginV0.Settings{
			ObjectMeta: metav1.ObjectMeta{Name: "instance", Namespace: "default"},
			Spec: apppluginV0.SettingsSpec{
				Enabled: false,
			},
		},
	)

	obj, created, err := storage.Update(ctx, "instance", updater, nil, nil, false, nil)
	require.NoError(t, err)
	require.False(t, created)

	settings := obj.(*apppluginV0.Settings)
	require.False(t, settings.Spec.Enabled)
}

func TestSettingsUpdate_DryRunDoesNotPersist(t *testing.T) {
	plugins := map[string]*pluginsettings.DTO{
		"test-app": {
			PluginID: "test-app",
			OrgID:    1,
			Enabled:  true,
		},
	}
	storage := newTestStorage(plugins)

	ctx := request.WithNamespace(context.Background(), "default")

	updater := rest.DefaultUpdatedObjectInfo(
		&apppluginV0.Settings{
			ObjectMeta: metav1.ObjectMeta{Name: "instance", Namespace: "default"},
			Spec: apppluginV0.SettingsSpec{
				Enabled: false,
			},
		},
	)

	obj, created, err := storage.Update(ctx, "instance", updater, nil, nil, false, &metav1.UpdateOptions{DryRun: []string{metav1.DryRunAll}})
	require.NoError(t, err)
	require.False(t, created)

	settings := obj.(*apppluginV0.Settings)
	require.False(t, settings.Spec.Enabled)
	require.True(t, plugins["test-app"].Enabled)
}

func TestSettingsDelete_Noop(t *testing.T) {
	storage := newTestStorage(map[string]*pluginsettings.DTO{})

	ctx := request.WithNamespace(context.Background(), "default")
	obj, deleted, err := storage.Delete(ctx, "instance", nil, nil)
	require.True(t, apierrors.IsMethodNotSupported(err), err)
	require.Nil(t, obj)
	require.False(t, deleted)
}

func TestSettingsDeleteCollection_Noop(t *testing.T) {
	storage := newTestStorage(map[string]*pluginsettings.DTO{})

	ctx := request.WithNamespace(context.Background(), "default")
	obj, err := storage.DeleteCollection(ctx, nil, nil, nil)
	require.True(t, apierrors.IsMethodNotSupported(err), err)
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

type readOnlySettings struct {
	plugins map[string]*pluginsettings.DTO
}

func (r readOnlySettings) GetPluginSettingByPluginID(_ context.Context, args *pluginsettings.GetByPluginIDArgs) (*pluginsettings.DTO, error) {
	if ps, ok := r.plugins[args.PluginID]; ok {
		return ps, nil
	}
	return nil, pluginsettings.ErrPluginSettingNotFound
}

func (readOnlySettings) DecryptedValues(*pluginsettings.DTO) map[string]string { return nil }

func TestReadOnlyLegacySettingsStore(t *testing.T) {
	plugins := map[string]*pluginsettings.DTO{
		"test-app": {PluginID: "test-app", OrgID: 1, Enabled: true, SecureJSONData: map[string][]byte{"key": []byte("x")}},
	}
	readOnly := NewReadOnlyLegacySettingsStore("test-app", readOnlySettings{plugins})
	// A reader with a write method stays read-only.
	writable := NewReadOnlyLegacySettingsStore("test-app", &pluginsettings.FakePluginSettings{Plugins: plugins})
	readWrite := newTestStorage(plugins)
	ctx := request.WithNamespace(context.Background(), "default")

	// Reads match the read-write store exactly.
	want, err := readWrite.Get(ctx, "instance", nil)
	require.NoError(t, err)
	got, err := readOnly.Get(ctx, "instance", nil)
	require.NoError(t, err)
	require.Equal(t, want, got)

	input := &apppluginV0.Settings{ObjectMeta: metav1.ObjectMeta{Name: "instance", Namespace: "default"}}
	_, err = readOnly.Create(ctx, input, nil, &metav1.CreateOptions{DryRun: []string{metav1.DryRunAll}})
	require.True(t, apierrors.IsMethodNotSupported(err), "dry runs are refused too: %v", err)
	_, _, err = readOnly.Update(ctx, "instance", rest.DefaultUpdatedObjectInfo(input), nil, nil, false, nil)
	require.True(t, apierrors.IsMethodNotSupported(err), err)
	_, err = writable.Create(ctx, input, nil, nil)
	require.True(t, apierrors.IsMethodNotSupported(err), err)
}

type failingSettings struct{ err error }

func (f failingSettings) GetPluginSettingByPluginID(context.Context, *pluginsettings.GetByPluginIDArgs) (*pluginsettings.DTO, error) {
	return nil, f.err
}

func (failingSettings) DecryptedValues(*pluginsettings.DTO) map[string]string { return nil }

func TestLegacySettingsStoreKeepsReaderStatus(t *testing.T) {
	ctx := request.WithNamespace(context.Background(), "default")
	forbidden := apierrors.NewForbidden(apppluginV0.SettingsResourceInfo.GroupResource(), "instance", errors.New("no"))
	_, err := NewReadOnlyLegacySettingsStore("test-app", failingSettings{forbidden}).Get(ctx, "instance", nil)
	require.Same(t, forbidden, err, "status errors must stay unwrapped")

	plain := errors.New("unavailable")
	_, err = NewReadOnlyLegacySettingsStore("test-app", failingSettings{plain}).Get(ctx, "instance", nil)
	require.ErrorIs(t, err, plain)
}
