package dashboard

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	jsonpatch "gopkg.in/evanphx/json-patch.v4"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/watch"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
)

func TestDashboardSettingsStorageUpdate(t *testing.T) {
	ctx := k8srequest.WithNamespace(context.Background(), "stacks-1")
	gr := dashv2beta1.DashboardSettingsResourceInfo.GroupResource()
	patchedPanels := &dashv2beta1.DashboardSettingsPanelDefaults{Width: new(float64(2))}

	newStore := func(fake *fakeDashboardSettingsStore) *dashboardSettingsStorage {
		return newDashboardSettingsStorage(fake, dashv2beta1.DashboardSettingsResourceInfo.GroupVersionKind(), nil)
	}
	// Objects the store holds always have a UID.
	stored := func(name string) *dashv2beta1.DashboardSettings {
		obj := newDashboardSettings(name, "", nil)
		obj.SetNamespace("stacks-1")
		obj.SetUID("stored-uid")
		return obj
	}
	// The patchers answer NotFound for an old object without a UID, so a PATCH on a missing object
	// gets a NotFound instead of a create.
	mergePatch := func(name, patch string) rest.UpdatedObjectInfo {
		return rest.DefaultUpdatedObjectInfo(nil, func(_ context.Context, _, oldObj runtime.Object) (runtime.Object, error) {
			old, ok := oldObj.(*dashv2beta1.DashboardSettings)
			if !ok {
				return nil, fmt.Errorf("expected dashboard settings, got %T", oldObj)
			}
			if old.UID == "" {
				return nil, apierrors.NewNotFound(gr, name)
			}
			current, err := json.Marshal(old)
			if err != nil {
				return nil, err
			}
			merged, err := jsonpatch.MergePatch(current, []byte(patch))
			if err != nil {
				return nil, err
			}
			patched := &dashv2beta1.DashboardSettings{}
			if err := json.Unmarshal(merged, patched); err != nil {
				return nil, err
			}
			return patched, nil
		})
	}
	const widthPatch = `{"spec":{"panels":{"width":2}}}`

	t.Run("a patch on a missing object creates it in the scope its name gives", func(t *testing.T) {
		tests := []struct {
			name            string
			wantAnnotations map[string]string
			wantUserUID     *string
		}{
			{name: "user-u1", wantUserUID: new("u1")},
			{name: "folder-f1", wantAnnotations: map[string]string{utils.AnnoKeyFolder: "f1"}},
			{name: "namespace"},
		}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				fake := newFakeDashboardSettingsStore()

				obj, created, err := newStore(fake).Update(ctx, tt.name, mergePatch(tt.name, widthPatch), nil, nil, false, &metav1.UpdateOptions{})
				require.NoError(t, err)
				require.True(t, created)

				got := requireDashboardSettings(t, obj)
				require.Equal(t, tt.name, got.Name)
				require.Equal(t, "stacks-1", got.Namespace)
				require.Equal(t, tt.wantAnnotations, got.GetAnnotations())
				require.Equal(t, tt.wantUserUID, got.Spec.UserUID)
				require.Equal(t, patchedPanels, got.Spec.Panels)

				require.Len(t, fake.updates, 1)
				require.Len(t, fake.creates, 1)
				require.Same(t, got, fake.items[tt.name])
			})
		}
	})

	// Both Kubernetes create paths wipe the system metadata a client sent, and the store fills in only
	// the UID and creation time. A deletion timestamp that got through would create an object that is
	// already being deleted.
	t.Run("a patch on a missing object can't set the system metadata of what it creates", func(t *testing.T) {
		fake := newFakeDashboardSettingsStore()
		const patch = `{"metadata":{"deletionTimestamp":"2020-01-01T00:00:00Z","deletionGracePeriodSeconds":0,"uid":"chosen","creationTimestamp":"2020-01-01T00:00:00Z"},"spec":{"panels":{"width":2}}}`

		obj, created, err := newStore(fake).Update(ctx, "user-u1", mergePatch("user-u1", patch), nil, nil, false, &metav1.UpdateOptions{})
		require.NoError(t, err)
		require.True(t, created)
		require.Equal(t, patchedPanels, requireDashboardSettings(t, obj).Spec.Panels)

		require.Len(t, fake.creates, 1)
		sent := fake.creates[0].obj
		require.Nil(t, sent.DeletionTimestamp)
		require.Nil(t, sent.DeletionGracePeriodSeconds)
		require.Empty(t, sent.UID)
		require.True(t, sent.CreationTimestamp.IsZero())
	})

	// PUT and apply build the object without an old one, so the store creates it itself.
	t.Run("a put on a missing object is created by the store", func(t *testing.T) {
		fake := newFakeDashboardSettingsStore()
		put := newDashboardSettings("user-u1", "", new("u1"))

		obj, created, err := newStore(fake).Update(ctx, "user-u1", rest.DefaultUpdatedObjectInfo(put), nil, nil, false, &metav1.UpdateOptions{})
		require.NoError(t, err)
		require.True(t, created)

		require.Equal(t, put, requireDashboardSettings(t, obj))
		require.Len(t, fake.updates, 1)
		require.Empty(t, fake.creates)
	})

	t.Run("a patch on an existing object updates it", func(t *testing.T) {
		existing := stored("user-u1")
		existing.Spec.UserUID = new("u1")
		existing.Spec.Preload = new(true)
		fake := newFakeDashboardSettingsStore(existing)

		obj, created, err := newStore(fake).Update(ctx, "user-u1", mergePatch("user-u1", widthPatch), nil, nil, false, &metav1.UpdateOptions{})
		require.NoError(t, err)
		require.False(t, created)

		got := requireDashboardSettings(t, obj)
		require.Equal(t, new(true), got.Spec.Preload)
		require.Equal(t, patchedPanels, got.Spec.Panels)
		require.Len(t, fake.updates, 1)
		require.Empty(t, fake.creates)
	})

	// Dropping an emptied panels object is Mutate's job, so storage hands back what the patch made.
	t.Run("a patch that nulls the last panel field leaves the empty panels object", func(t *testing.T) {
		existing := stored("namespace")
		existing.Spec.Panels = &dashv2beta1.DashboardSettingsPanelDefaults{Width: new(float64(2))}
		fake := newFakeDashboardSettingsStore(existing)

		obj, created, err := newStore(fake).Update(ctx, "namespace", mergePatch("namespace", `{"spec":{"panels":{"width":null}}}`), nil, nil, false, &metav1.UpdateOptions{})
		require.NoError(t, err)
		require.False(t, created)

		got := requireDashboardSettings(t, obj)
		require.NotNil(t, got.Spec.Panels)
		require.Nil(t, got.Spec.Panels.Width)
	})

	t.Run("losing a create race patches the object that won", func(t *testing.T) {
		winner := stored("user-u1")
		winner.Spec.UserUID = new("u1")
		winner.Spec.Preload = new(true)
		fake := newFakeDashboardSettingsStore()
		fake.concurrent = winner
		options := &metav1.UpdateOptions{FieldManager: "test"}

		obj, created, err := newStore(fake).Update(ctx, "user-u1", mergePatch("user-u1", widthPatch), nil, nil, true, options)
		require.NoError(t, err)
		require.False(t, created)

		got := requireDashboardSettings(t, obj)
		require.Equal(t, new(true), got.Spec.Preload)
		require.Equal(t, patchedPanels, got.Spec.Panels)
		require.Len(t, fake.creates, 1)
		require.Equal(t, []dashboardSettingsUpdateCall{
			{name: "user-u1", forceAllowCreate: true, options: options},
			{name: "user-u1", forceAllowCreate: true, options: options},
		}, fake.updates)
	})

	t.Run("an error other than the object's own NotFound is returned unchanged", func(t *testing.T) {
		tests := []struct {
			name string
			err  error
		}{
			// The create validation reports this for a folder-tier object whose folder is gone.
			{name: "NotFound for a folder", err: apierrors.NewNotFound(folders.FolderResourceInfo.GroupResource(), "f1")},
			{name: "Forbidden", err: apierrors.NewForbidden(gr, "folder-f1", errors.New("nope"))},
		}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				fake := newFakeDashboardSettingsStore()
				fake.updateErr = tt.err

				obj, created, err := newStore(fake).Update(ctx, "folder-f1", mergePatch("folder-f1", widthPatch), nil, nil, false, &metav1.UpdateOptions{})
				require.Same(t, tt.err, err)
				require.Nil(t, obj)
				require.False(t, created)

				require.Len(t, fake.updates, 1)
				require.Empty(t, fake.creates)
			})
		}
	})

	t.Run("an error from applying the update to the placeholder is returned unchanged", func(t *testing.T) {
		fake := newFakeDashboardSettingsStore()
		rejected := apierrors.NewBadRequest("rejected")
		// A patch that admission refuses fails like this, but only once the old object has a UID.
		rejectedPatch := rest.DefaultUpdatedObjectInfo(nil, func(_ context.Context, _, oldObj runtime.Object) (runtime.Object, error) {
			if requireDashboardSettings(t, oldObj).UID == "" {
				return nil, apierrors.NewNotFound(gr, "user-u1")
			}
			return nil, rejected
		})

		obj, created, err := newStore(fake).Update(ctx, "user-u1", rejectedPatch, nil, nil, false, &metav1.UpdateOptions{})
		require.Same(t, rejected, err)
		require.Nil(t, obj)
		require.False(t, created)

		require.Len(t, fake.updates, 1)
		require.Empty(t, fake.creates)
	})

	t.Run("a name outside every tier is a bad request", func(t *testing.T) {
		// The authorizer rejects these names first, so the storage only has to refuse to build an
		// object it can't scope.
		for _, name := range []string{"bogus", "folder-general", "user-"} {
			t.Run(name, func(t *testing.T) {
				fake := newFakeDashboardSettingsStore()

				_, created, err := newStore(fake).Update(ctx, name, mergePatch(name, widthPatch), nil, nil, false, &metav1.UpdateOptions{})
				require.True(t, apierrors.IsBadRequest(err), "expected a BadRequest, got %v", err)
				require.ErrorContains(t, err, "invalid dashboard settings name")
				require.False(t, created)

				require.Empty(t, fake.creates)
			})
		}
	})

	// The create validation is where admission authorizes and checks the name and folder, so it has
	// to see the patched object, scope included.
	t.Run("the create validation judges the object a patch creates", func(t *testing.T) {
		fake := newFakeDashboardSettingsStore()
		rejected := apierrors.NewBadRequest("rejected")
		var validated *dashv2beta1.DashboardSettings
		createValidation := func(_ context.Context, obj runtime.Object) error {
			validated = requireDashboardSettings(t, obj)
			return rejected
		}

		obj, created, err := newStore(fake).Update(ctx, "user-u1", mergePatch("user-u1", widthPatch), createValidation, nil, false, &metav1.UpdateOptions{})
		require.Same(t, rejected, err)
		require.Nil(t, obj)
		require.False(t, created)

		require.NotNil(t, validated)
		require.Equal(t, new("u1"), validated.Spec.UserUID)
		require.Equal(t, patchedPanels, validated.Spec.Panels)
		require.Empty(t, fake.items)
	})

	t.Run("the create options follow the update options", func(t *testing.T) {
		tests := []struct {
			name    string
			options *metav1.UpdateOptions
			want    *metav1.CreateOptions
		}{
			{
				name:    "all of them",
				options: &metav1.UpdateOptions{DryRun: []string{metav1.DryRunAll}, FieldManager: "test", FieldValidation: "Strict"},
				want:    &metav1.CreateOptions{DryRun: []string{metav1.DryRunAll}, FieldManager: "test", FieldValidation: "Strict"},
			},
			{name: "none", options: nil, want: &metav1.CreateOptions{}},
		}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				fake := newFakeDashboardSettingsStore()

				_, created, err := newStore(fake).Update(ctx, "namespace", mergePatch("namespace", widthPatch), nil, nil, false, tt.options)
				require.NoError(t, err)
				require.True(t, created)

				require.Len(t, fake.creates, 1)
				require.Equal(t, tt.want, fake.creates[0].options)
			})
		}
	})
}

func TestDashboardSettingsStorageNewEmptyDashboardSettings(t *testing.T) {
	ctx := k8srequest.WithNamespace(context.Background(), "stacks-1")
	gvk := dashv2beta1.DashboardSettingsResourceInfo.GroupVersionKind()
	store := newDashboardSettingsStorage(newFakeDashboardSettingsStore(), gvk, nil)

	tests := []struct {
		name            string
		wantAnnotations map[string]string
		wantUserUID     *string
	}{
		{name: "namespace"},
		{name: "folder-f1", wantAnnotations: map[string]string{utils.AnnoKeyFolder: "f1"}},
		{name: "user-u1", wantUserUID: new("u1")},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			obj, err := store.newEmptyDashboardSettings(ctx, tt.name)
			require.NoError(t, err)

			require.Equal(t, gvk, obj.GroupVersionKind())
			require.Equal(t, tt.name, obj.Name)
			require.Equal(t, "stacks-1", obj.Namespace)
			require.Equal(t, tt.wantAnnotations, obj.GetAnnotations())
			require.Equal(t, dashv2beta1.DashboardSettingsSpec{UserUID: tt.wantUserUID}, obj.Spec)
			// The UID hashes the kind, namespace and name, so it only matches when it is set after them.
			require.Equal(t, gapiutil.CalculateClusterWideUID(obj), obj.UID)
		})
	}
}

// A wrapper that picked these up from the store would expose or delete other users' user tier objects.
func TestDashboardSettingsStorageHidesWatchAndDeleteCollection(t *testing.T) {
	wrapped := &watchableDashboardSettingsStore{newFakeDashboardSettingsStore()}
	require.Implements(t, (*rest.Watcher)(nil), wrapped)
	require.Implements(t, (*rest.CollectionDeleter)(nil), wrapped)

	store := newDashboardSettingsStorage(wrapped, dashv2beta1.DashboardSettingsResourceInfo.GroupVersionKind(), nil)

	require.NotImplements(t, (*rest.Watcher)(nil), store)
	require.NotImplements(t, (*rest.CollectionDeleter)(nil), store)
}

func TestIsDashboardSettingsNotFound(t *testing.T) {
	gr := dashv2beta1.DashboardSettingsResourceInfo.GroupResource()

	tests := []struct {
		name string
		err  error
		want bool
	}{
		{name: "this resource and name", err: apierrors.NewNotFound(gr, "folder-f1"), want: true},
		{name: "wrapped", err: fmt.Errorf("update: %w", apierrors.NewNotFound(gr, "folder-f1")), want: true},
		{name: "another name", err: apierrors.NewNotFound(gr, "folder-f2")},
		{name: "another resource", err: apierrors.NewNotFound(schema.GroupResource{Group: gr.Group, Resource: "dashboards"}, "folder-f1")},
		{name: "another group", err: apierrors.NewNotFound(schema.GroupResource{Group: "folder.grafana.app", Resource: gr.Resource}, "folder-f1")},
		{name: "a folder", err: apierrors.NewNotFound(folders.FolderResourceInfo.GroupResource(), "f1")},
		{name: "a NotFound without details", err: &apierrors.StatusError{ErrStatus: metav1.Status{Reason: metav1.StatusReasonNotFound}}},
		{name: "another failure for this object", err: apierrors.NewForbidden(gr, "folder-f1", errors.New("nope"))},
		{name: "not an API error", err: errors.New("dashboard settings not found")},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, isDashboardSettingsNotFound(tt.err, "folder-f1"))
		})
	}
}

func requireDashboardSettings(t *testing.T, obj runtime.Object) *dashv2beta1.DashboardSettings {
	t.Helper()
	settings, ok := obj.(*dashv2beta1.DashboardSettings)
	require.True(t, ok, "expected dashboard settings, got %T", obj)
	return settings
}

type dashboardSettingsUpdateCall struct {
	name             string
	forceAllowCreate bool
	options          *metav1.UpdateOptions
}

type dashboardSettingsCreateCall struct {
	obj     *dashv2beta1.DashboardSettings
	options *metav1.CreateOptions
}

// fakeDashboardSettingsStore stands in for the registry store: it keeps objects by name, records the
// calls the wrapper makes, and fails the way the store does. Any other call panics.
type fakeDashboardSettingsStore struct {
	grafanarest.Storage
	items map[string]*dashv2beta1.DashboardSettings

	// Returned by every Update, in place of looking the object up.
	updateErr error
	// Stored by another request just before the next Create runs.
	concurrent *dashv2beta1.DashboardSettings

	updates []dashboardSettingsUpdateCall
	creates []dashboardSettingsCreateCall
}

func newFakeDashboardSettingsStore(items ...*dashv2beta1.DashboardSettings) *fakeDashboardSettingsStore {
	f := &fakeDashboardSettingsStore{items: map[string]*dashv2beta1.DashboardSettings{}}
	for _, item := range items {
		f.items[item.Name] = item
	}
	return f
}

func (f *fakeDashboardSettingsStore) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, _ rest.ValidateObjectFunc, _ rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	f.updates = append(f.updates, dashboardSettingsUpdateCall{name: name, forceAllowCreate: forceAllowCreate, options: options})
	if f.updateErr != nil {
		return nil, false, f.updateErr
	}

	// The registry store hands the transformer an empty object when nothing is stored.
	old, exists := f.items[name]
	if !exists {
		old = &dashv2beta1.DashboardSettings{}
	}
	obj, err := objInfo.UpdatedObject(ctx, old)
	if err != nil {
		return nil, false, err
	}
	settings, ok := obj.(*dashv2beta1.DashboardSettings)
	if !ok {
		return nil, false, fmt.Errorf("expected dashboard settings, got %T", obj)
	}
	f.items[name] = settings
	return settings, !exists, nil
}

func (f *fakeDashboardSettingsStore) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	settings, ok := obj.(*dashv2beta1.DashboardSettings)
	if !ok {
		return nil, fmt.Errorf("expected dashboard settings, got %T", obj)
	}
	f.creates = append(f.creates, dashboardSettingsCreateCall{obj: settings, options: options})

	if f.concurrent != nil {
		f.items[f.concurrent.Name] = f.concurrent
		f.concurrent = nil
	}
	if createValidation != nil {
		if err := createValidation(ctx, settings.DeepCopyObject()); err != nil {
			return nil, err
		}
	}
	if _, exists := f.items[settings.Name]; exists {
		return nil, apierrors.NewAlreadyExists(dashv2beta1.DashboardSettingsResourceInfo.GroupResource(), settings.Name)
	}
	// Like the registry store, it answers with a new object, so a caller that returns the object it
	// passed in instead of the answer is caught.
	stored := settings.DeepCopy()
	f.items[stored.Name] = stored
	return stored, nil
}

// watchableDashboardSettingsStore is a store that serves watch and deletecollection, as the registry
// store does.
type watchableDashboardSettingsStore struct {
	*fakeDashboardSettingsStore
}

func (*watchableDashboardSettingsStore) Watch(context.Context, *metainternalversion.ListOptions) (watch.Interface, error) {
	return watch.NewEmptyWatch(), nil
}

func (*watchableDashboardSettingsStore) DeleteCollection(context.Context, rest.ValidateObjectFunc, *metav1.DeleteOptions, *metainternalversion.ListOptions) (runtime.Object, error) {
	return nil, nil
}
