package plugins

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	pluginsV0 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
)

// errPluginSettings wraps FakePluginSettings to inject errors on specific methods.
type errPluginSettings struct {
	*pluginsettings.FakePluginSettings
	getListErr error
	getByIDErr error
	updateErr  error
}

func (e *errPluginSettings) GetPluginSettings(ctx context.Context, args *pluginsettings.GetArgs) ([]*pluginsettings.InfoDTO, error) {
	if e.getListErr != nil {
		return nil, e.getListErr
	}
	return e.FakePluginSettings.GetPluginSettings(ctx, args)
}

func (e *errPluginSettings) GetPluginSettingByPluginID(ctx context.Context, args *pluginsettings.GetByPluginIDArgs) (*pluginsettings.DTO, error) {
	if e.getByIDErr != nil {
		return nil, e.getByIDErr
	}
	return e.FakePluginSettings.GetPluginSettingByPluginID(ctx, args)
}

func (e *errPluginSettings) UpdatePluginSetting(ctx context.Context, args *pluginsettings.UpdateArgs) error {
	if e.updateErr != nil {
		return e.updateErr
	}
	return e.FakePluginSettings.UpdatePluginSetting(ctx, args)
}

func newTestStorage(svc pluginsettings.Service) *legacyStorage {
	return &legacyStorage{
		pluginSettings: svc,
		tableConverter: newAppsTableConverter(),
	}
}

func newFakeStorage(plugins map[string]*pluginsettings.DTO) *legacyStorage {
	return newTestStorage(&pluginsettings.FakePluginSettings{Plugins: plugins})
}

func orgCtx() context.Context {
	// namespace "default" maps to OrgID=1
	return request.WithNamespace(context.Background(), "default")
}

func TestLegacyStorage_SimpleMethods(t *testing.T) {
	s := newFakeStorage(nil)

	require.IsType(t, &pluginsV0.App{}, s.New())
	require.IsType(t, &pluginsV0.AppList{}, s.NewList())
	require.True(t, s.NamespaceScoped())
	require.Equal(t, "app", s.GetSingularName())
	// Destroy is a no-op but should not panic.
	require.NotPanics(t, func() { s.Destroy() })
}

func TestLegacyStorage_List(t *testing.T) {
	t.Run("returns apps for the org", func(t *testing.T) {
		s := newFakeStorage(map[string]*pluginsettings.DTO{
			"plugin-a": {PluginID: "plugin-a", OrgID: 1, Enabled: true, Pinned: false},
			"plugin-b": {PluginID: "plugin-b", OrgID: 1, Enabled: false, Pinned: true},
		})

		obj, err := s.List(orgCtx(), nil)
		require.NoError(t, err)

		list, ok := obj.(*pluginsV0.AppList)
		require.True(t, ok)
		require.Len(t, list.Items, 2)

		// Verify the items contain the expected plugins (order is map-iteration order).
		byName := map[string]pluginsV0.App{}
		for _, item := range list.Items {
			require.NotEmpty(t, item.ResourceVersion)
			require.NotEmpty(t, item.UID)
			byName[item.Name] = item
		}
		require.Contains(t, byName, "plugin-a")
		require.Contains(t, byName, "plugin-b")
		require.True(t, byName["plugin-a"].Spec.Enabled)
		require.False(t, byName["plugin-a"].Spec.Pinned)
		require.False(t, byName["plugin-b"].Spec.Enabled)
		require.True(t, byName["plugin-b"].Spec.Pinned)
	})

	t.Run("empty list when no plugins", func(t *testing.T) {
		s := newFakeStorage(map[string]*pluginsettings.DTO{})

		obj, err := s.List(orgCtx(), nil)
		require.NoError(t, err)

		list := obj.(*pluginsV0.AppList)
		require.NotNil(t, list.Items)
		require.Len(t, list.Items, 0)
	})

	t.Run("propagates org ID resolution error", func(t *testing.T) {
		s := newFakeStorage(nil)

		// No namespace and no requester on context -> OrgIDForList errors.
		obj, err := s.List(context.Background(), nil)
		require.Error(t, err)
		require.Nil(t, obj)
	})

	t.Run("propagates pluginSettings error", func(t *testing.T) {
		boom := errors.New("boom")
		s := newTestStorage(&errPluginSettings{
			FakePluginSettings: &pluginsettings.FakePluginSettings{Plugins: map[string]*pluginsettings.DTO{}},
			getListErr:         boom,
		})

		obj, err := s.List(orgCtx(), nil)
		require.ErrorIs(t, err, boom)
		require.Nil(t, obj)
	})
}

func TestLegacyStorage_Get(t *testing.T) {
	t.Run("returns the app", func(t *testing.T) {
		s := newFakeStorage(map[string]*pluginsettings.DTO{
			"plugin-a": {PluginID: "plugin-a", OrgID: 1, Enabled: true, Pinned: true},
		})

		obj, err := s.Get(orgCtx(), "plugin-a", &metav1.GetOptions{})
		require.NoError(t, err)

		app := obj.(*pluginsV0.App)
		require.Equal(t, "plugin-a", app.Name)
		require.True(t, app.Spec.Enabled)
		require.True(t, app.Spec.Pinned)
		require.NotEmpty(t, app.UID)
		require.NotEmpty(t, app.ResourceVersion)
	})

	t.Run("not found returns k8s NotFound error", func(t *testing.T) {
		s := newFakeStorage(map[string]*pluginsettings.DTO{})

		obj, err := s.Get(orgCtx(), "missing", &metav1.GetOptions{})
		require.Error(t, err)
		require.Nil(t, obj)
		require.True(t, k8serrors.IsNotFound(err))
	})

	t.Run("propagates non-NotFound pluginSettings error", func(t *testing.T) {
		boom := errors.New("boom")
		s := newTestStorage(&errPluginSettings{
			FakePluginSettings: &pluginsettings.FakePluginSettings{Plugins: map[string]*pluginsettings.DTO{}},
			getByIDErr:         boom,
		})

		obj, err := s.Get(orgCtx(), "plugin-a", &metav1.GetOptions{})
		require.ErrorIs(t, err, boom)
		require.Nil(t, obj)
	})

	t.Run("propagates org ID resolution error", func(t *testing.T) {
		s := newFakeStorage(nil)

		obj, err := s.Get(context.Background(), "plugin-a", &metav1.GetOptions{})
		require.Error(t, err)
		require.Nil(t, obj)
	})
}

func TestLegacyStorage_Create(t *testing.T) {
	t.Run("creates an app via upsert", func(t *testing.T) {
		s := newFakeStorage(map[string]*pluginsettings.DTO{})

		input := &pluginsV0.App{
			ObjectMeta: metav1.ObjectMeta{Name: "plugin-a"},
			Spec:       pluginsV0.AppSpec{Enabled: true, Pinned: true},
		}

		obj, err := s.Create(orgCtx(), input, nil, &metav1.CreateOptions{})
		require.NoError(t, err)

		app := obj.(*pluginsV0.App)
		require.Equal(t, "plugin-a", app.Name)
		require.True(t, app.Spec.Enabled)
		require.True(t, app.Spec.Pinned)
	})

	t.Run("returns error when input is not an App", func(t *testing.T) {
		s := newFakeStorage(map[string]*pluginsettings.DTO{})

		obj, err := s.Create(orgCtx(), &pluginsV0.AppList{}, nil, &metav1.CreateOptions{})
		require.Error(t, err)
		require.Nil(t, obj)
	})

	t.Run("propagates validation error", func(t *testing.T) {
		s := newFakeStorage(map[string]*pluginsettings.DTO{})

		validationErr := errors.New("validation failed")
		validator := func(_ context.Context, _ runtime.Object) error {
			return validationErr
		}

		input := &pluginsV0.App{
			ObjectMeta: metav1.ObjectMeta{Name: "plugin-a"},
		}

		obj, err := s.Create(orgCtx(), input, validator, &metav1.CreateOptions{})
		require.ErrorIs(t, err, validationErr)
		require.Nil(t, obj)
	})

	t.Run("propagates upsert error", func(t *testing.T) {
		boom := errors.New("update failed")
		s := newTestStorage(&errPluginSettings{
			FakePluginSettings: &pluginsettings.FakePluginSettings{Plugins: map[string]*pluginsettings.DTO{}},
			updateErr:          boom,
		})

		input := &pluginsV0.App{
			ObjectMeta: metav1.ObjectMeta{Name: "plugin-a"},
		}

		obj, err := s.Create(orgCtx(), input, nil, &metav1.CreateOptions{})
		require.ErrorIs(t, err, boom)
		require.Nil(t, obj)
	})

	t.Run("propagates org ID resolution error from upsert", func(t *testing.T) {
		s := newFakeStorage(map[string]*pluginsettings.DTO{})

		input := &pluginsV0.App{
			ObjectMeta: metav1.ObjectMeta{Name: "plugin-a"},
		}

		obj, err := s.Create(context.Background(), input, nil, &metav1.CreateOptions{})
		require.Error(t, err)
		require.Nil(t, obj)
	})
}

func TestLegacyStorage_Update(t *testing.T) {
	t.Run("updates an existing app", func(t *testing.T) {
		s := newFakeStorage(map[string]*pluginsettings.DTO{
			"plugin-a": {PluginID: "plugin-a", OrgID: 1, Enabled: false, Pinned: false},
		})

		updater := rest.DefaultUpdatedObjectInfo(&pluginsV0.App{
			ObjectMeta: metav1.ObjectMeta{Name: "plugin-a"},
			Spec:       pluginsV0.AppSpec{Enabled: true, Pinned: true},
		})

		obj, created, err := s.Update(orgCtx(), "plugin-a", updater, nil, nil, false, &metav1.UpdateOptions{})
		require.NoError(t, err)
		require.False(t, created)

		app := obj.(*pluginsV0.App)
		require.True(t, app.Spec.Enabled)
		require.True(t, app.Spec.Pinned)
	})

	t.Run("returns error when app does not exist", func(t *testing.T) {
		s := newFakeStorage(map[string]*pluginsettings.DTO{})

		updater := rest.DefaultUpdatedObjectInfo(&pluginsV0.App{
			ObjectMeta: metav1.ObjectMeta{Name: "missing"},
		})

		obj, created, err := s.Update(orgCtx(), "missing", updater, nil, nil, false, &metav1.UpdateOptions{})
		require.Error(t, err)
		require.True(t, k8serrors.IsNotFound(err))
		require.False(t, created)
		require.Nil(t, obj)
	})

	t.Run("returns error when UpdatedObject returns an error", func(t *testing.T) {
		s := newFakeStorage(map[string]*pluginsettings.DTO{
			"plugin-a": {PluginID: "plugin-a", OrgID: 1},
		})

		boom := errors.New("transform failed")
		updater := &fakeUpdatedObjectInfo{err: boom}

		obj, created, err := s.Update(orgCtx(), "plugin-a", updater, nil, nil, false, &metav1.UpdateOptions{})
		require.ErrorIs(t, err, boom)
		require.False(t, created)
		require.Nil(t, obj)
	})

	t.Run("returns error when updated object is not an App", func(t *testing.T) {
		s := newFakeStorage(map[string]*pluginsettings.DTO{
			"plugin-a": {PluginID: "plugin-a", OrgID: 1},
		})

		updater := &fakeUpdatedObjectInfo{obj: &pluginsV0.AppList{}}

		obj, created, err := s.Update(orgCtx(), "plugin-a", updater, nil, nil, false, &metav1.UpdateOptions{})
		require.Error(t, err)
		require.False(t, created)
		require.Nil(t, obj)
	})

	t.Run("propagates validation error", func(t *testing.T) {
		s := newFakeStorage(map[string]*pluginsettings.DTO{
			"plugin-a": {PluginID: "plugin-a", OrgID: 1},
		})

		updater := rest.DefaultUpdatedObjectInfo(&pluginsV0.App{
			ObjectMeta: metav1.ObjectMeta{Name: "plugin-a"},
			Spec:       pluginsV0.AppSpec{Enabled: true},
		})

		validationErr := errors.New("validation failed")
		validator := func(_ context.Context, _, _ runtime.Object) error {
			return validationErr
		}

		obj, created, err := s.Update(orgCtx(), "plugin-a", updater, nil, validator, false, &metav1.UpdateOptions{})
		require.ErrorIs(t, err, validationErr)
		require.False(t, created)
		require.Nil(t, obj)
	})

	t.Run("propagates upsert error", func(t *testing.T) {
		boom := errors.New("update failed")
		svc := &errPluginSettings{
			FakePluginSettings: &pluginsettings.FakePluginSettings{Plugins: map[string]*pluginsettings.DTO{
				"plugin-a": {PluginID: "plugin-a", OrgID: 1},
			}},
		}
		s := newTestStorage(svc)

		updater := rest.DefaultUpdatedObjectInfo(&pluginsV0.App{
			ObjectMeta: metav1.ObjectMeta{Name: "plugin-a"},
			Spec:       pluginsV0.AppSpec{Enabled: true},
		})

		// Enable the error only after the initial Get has succeeded.
		svc.updateErr = boom

		obj, created, err := s.Update(orgCtx(), "plugin-a", updater, nil, nil, false, &metav1.UpdateOptions{})
		require.ErrorIs(t, err, boom)
		require.False(t, created)
		require.Nil(t, obj)
	})
}

func TestLegacyStorage_Delete(t *testing.T) {
	t.Run("disables and returns the app", func(t *testing.T) {
		store := map[string]*pluginsettings.DTO{
			"plugin-a": {PluginID: "plugin-a", OrgID: 1, Enabled: true, Pinned: true},
		}
		s := newFakeStorage(store)

		obj, deleted, err := s.Delete(orgCtx(), "plugin-a", nil, &metav1.DeleteOptions{})
		require.NoError(t, err)
		require.True(t, deleted)

		app := obj.(*pluginsV0.App)
		require.False(t, app.Spec.Enabled)
		require.False(t, app.Spec.Pinned)

		// Verify the underlying setting was updated.
		require.False(t, store["plugin-a"].Enabled)
		require.False(t, store["plugin-a"].Pinned)
	})

	t.Run("returns NotFound when app does not exist", func(t *testing.T) {
		s := newFakeStorage(map[string]*pluginsettings.DTO{})

		obj, deleted, err := s.Delete(orgCtx(), "missing", nil, &metav1.DeleteOptions{})
		require.Error(t, err)
		require.True(t, k8serrors.IsNotFound(err))
		require.False(t, deleted)
		require.Nil(t, obj)
	})

	t.Run("propagates validation error", func(t *testing.T) {
		s := newFakeStorage(map[string]*pluginsettings.DTO{
			"plugin-a": {PluginID: "plugin-a", OrgID: 1, Enabled: true},
		})

		validationErr := errors.New("cannot delete")
		validator := func(_ context.Context, _ runtime.Object) error {
			return validationErr
		}

		obj, deleted, err := s.Delete(orgCtx(), "plugin-a", validator, &metav1.DeleteOptions{})
		require.ErrorIs(t, err, validationErr)
		require.False(t, deleted)
		// On validation failure the existing object is returned for context.
		require.NotNil(t, obj)
	})
}

func TestLegacyStorage_ConvertToTable(t *testing.T) {
	s := newFakeStorage(map[string]*pluginsettings.DTO{
		"plugin-a": {PluginID: "plugin-a", OrgID: 1, Enabled: true, Pinned: false},
	})

	obj, err := s.Get(orgCtx(), "plugin-a", &metav1.GetOptions{})
	require.NoError(t, err)

	table, err := s.ConvertToTable(orgCtx(), obj, &metav1.TableOptions{})
	require.NoError(t, err)
	require.Len(t, table.Rows, 1)
	require.Equal(t, []any{"plugin-a", true, false}, table.Rows[0].Cells)
}

func TestLegacyStorage_toApp_DeterministicUID(t *testing.T) {
	// Patch now() so the test is deterministic.
	original := now
	t.Cleanup(func() { now = original })
	fixed := metav1.NewTime(time.Unix(1700000000, 0))
	now = func() metav1.Time { return fixed }

	app := toApp("plugin-a", true, false, now())
	require.Equal(t, "plugin-a", app.Name)
	require.True(t, app.Spec.Enabled)
	require.False(t, app.Spec.Pinned)
	require.Equal(t, fmt.Sprintf("%d", fixed.UnixMilli()), app.ResourceVersion)
	require.NotEmpty(t, app.UID)
}

// fakeUpdatedObjectInfo lets us inject specific return values from UpdatedObject.
type fakeUpdatedObjectInfo struct {
	obj runtime.Object
	err error
}

func (f *fakeUpdatedObjectInfo) Preconditions() *metav1.Preconditions { return nil }

func (f *fakeUpdatedObjectInfo) UpdatedObject(_ context.Context, _ runtime.Object) (runtime.Object, error) {
	if f.err != nil {
		return nil, f.err
	}
	return f.obj, nil
}
