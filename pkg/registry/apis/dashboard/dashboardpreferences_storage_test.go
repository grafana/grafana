package dashboard

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strconv"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	jsonpatch "gopkg.in/evanphx/json-patch.v4"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/watch"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
)

func TestDashboardPreferencesStorageUpdate(t *testing.T) {
	ctx := k8srequest.WithNamespace(context.Background(), "stacks-1")
	gr := dashv2beta1.DashboardPreferencesResourceInfo.GroupResource()
	patchedDashboard := &dashv2beta1.DashboardPreferencesDashboardDefaults{Preload: new(true)}

	newStore := func(fake *fakeDashboardPreferencesStore) *dashboardPreferencesStorage {
		return newDashboardPreferencesStorage(fake, dashv2beta1.DashboardPreferencesResourceInfo.GroupVersionKind(), nil)
	}
	// Objects the store holds always have a UID.
	stored := func(name string) *dashv2beta1.DashboardPreferences {
		obj := newDashboardPreferences(name, "", nil)
		obj.SetNamespace("stacks-1")
		obj.SetUID("stored-uid")
		return obj
	}
	// The patchers answer NotFound for an old object without a UID, so a PATCH on a missing object
	// gets a NotFound instead of a create.
	mergePatch := func(name, patch string) rest.UpdatedObjectInfo {
		return rest.DefaultUpdatedObjectInfo(nil, func(_ context.Context, _, oldObj runtime.Object) (runtime.Object, error) {
			old, ok := oldObj.(*dashv2beta1.DashboardPreferences)
			if !ok {
				return nil, fmt.Errorf("expected dashboard preferences, got %T", oldObj)
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
			patched := &dashv2beta1.DashboardPreferences{}
			if err := json.Unmarshal(merged, patched); err != nil {
				return nil, err
			}
			return patched, nil
		})
	}
	const preloadPatch = `{"spec":{"dashboard":{"preload":true}}}`

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
				fake := newFakeDashboardPreferencesStore()

				obj, created, err := newStore(fake).Update(ctx, tt.name, mergePatch(tt.name, preloadPatch), nil, nil, false, &metav1.UpdateOptions{})
				require.NoError(t, err)
				require.True(t, created)

				got := requireDashboardPreferences(t, obj)
				require.Equal(t, tt.name, got.Name)
				require.Equal(t, "stacks-1", got.Namespace)
				require.Equal(t, tt.wantAnnotations, got.GetAnnotations())
				require.Equal(t, tt.wantUserUID, got.Spec.UserUID)
				require.Equal(t, patchedDashboard, got.Spec.Dashboard)

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
		fake := newFakeDashboardPreferencesStore()
		const patch = `{"metadata":{"deletionTimestamp":"2020-01-01T00:00:00Z","deletionGracePeriodSeconds":0,"uid":"chosen","creationTimestamp":"2020-01-01T00:00:00Z"},"spec":{"dashboard":{"preload":true}}}`

		obj, created, err := newStore(fake).Update(ctx, "user-u1", mergePatch("user-u1", patch), nil, nil, false, &metav1.UpdateOptions{})
		require.NoError(t, err)
		require.True(t, created)
		require.Equal(t, patchedDashboard, requireDashboardPreferences(t, obj).Spec.Dashboard)

		require.Len(t, fake.creates, 1)
		sent := fake.creates[0].obj
		require.Nil(t, sent.DeletionTimestamp)
		require.Nil(t, sent.DeletionGracePeriodSeconds)
		require.Empty(t, sent.UID)
		require.True(t, sent.CreationTimestamp.IsZero())
	})

	// PUT and apply build the object without an old one, so the store creates it itself.
	t.Run("a put on a missing object is created by the store", func(t *testing.T) {
		fake := newFakeDashboardPreferencesStore()
		put := newDashboardPreferences("user-u1", "", new("u1"))

		obj, created, err := newStore(fake).Update(ctx, "user-u1", rest.DefaultUpdatedObjectInfo(put), nil, nil, false, &metav1.UpdateOptions{})
		require.NoError(t, err)
		require.True(t, created)

		require.Equal(t, put, requireDashboardPreferences(t, obj))
		require.Len(t, fake.updates, 1)
		require.Empty(t, fake.creates)
	})

	t.Run("a patch on an existing object updates it", func(t *testing.T) {
		existing := stored("user-u1")
		existing.Spec.UserUID = new("u1")
		existing.Spec.Dashboard = &dashv2beta1.DashboardPreferencesDashboardDefaults{AutoRefresh: new("1m")}
		fake := newFakeDashboardPreferencesStore(existing)

		obj, created, err := newStore(fake).Update(ctx, "user-u1", mergePatch("user-u1", preloadPatch), nil, nil, false, &metav1.UpdateOptions{})
		require.NoError(t, err)
		require.False(t, created)

		got := requireDashboardPreferences(t, obj)
		require.Equal(t, &dashv2beta1.DashboardPreferencesDashboardDefaults{AutoRefresh: new("1m"), Preload: new(true)}, got.Spec.Dashboard)
		require.Len(t, fake.updates, 1)
		require.Empty(t, fake.creates)
	})

	// Dropping an emptied object is Mutate's job, so storage hands back what the patch made.
	t.Run("a patch that nulls the last member of an object leaves the empty object", func(t *testing.T) {
		existing := stored("namespace")
		existing.Spec.Dashboard = &dashv2beta1.DashboardPreferencesDashboardDefaults{
			AutoGrid: &dashv2beta1.DashboardPreferencesV2beta1DashboardDefaultsAutoGrid{FillScreen: new(true)},
		}
		fake := newFakeDashboardPreferencesStore(existing)

		obj, created, err := newStore(fake).Update(ctx, "namespace", mergePatch("namespace", `{"spec":{"dashboard":{"autoGrid":{"fillScreen":null}}}}`), nil, nil, false, &metav1.UpdateOptions{})
		require.NoError(t, err)
		require.False(t, created)

		got := requireDashboardPreferences(t, obj)
		require.NotNil(t, got.Spec.Dashboard)
		require.Equal(t, &dashv2beta1.DashboardPreferencesV2beta1DashboardDefaultsAutoGrid{}, got.Spec.Dashboard.AutoGrid)
	})

	t.Run("losing a create race patches the object that won", func(t *testing.T) {
		winner := stored("user-u1")
		winner.Spec.UserUID = new("u1")
		winner.Spec.Dashboard = &dashv2beta1.DashboardPreferencesDashboardDefaults{AutoRefresh: new("1m")}
		fake := newFakeDashboardPreferencesStore()
		fake.concurrent = winner
		options := &metav1.UpdateOptions{FieldManager: "test"}

		obj, created, err := newStore(fake).Update(ctx, "user-u1", mergePatch("user-u1", preloadPatch), nil, nil, true, options)
		require.NoError(t, err)
		require.False(t, created)

		got := requireDashboardPreferences(t, obj)
		require.Equal(t, &dashv2beta1.DashboardPreferencesDashboardDefaults{AutoRefresh: new("1m"), Preload: new(true)}, got.Spec.Dashboard)
		require.Len(t, fake.creates, 1)
		require.Equal(t, []dashboardPreferencesUpdateCall{
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
				fake := newFakeDashboardPreferencesStore()
				fake.updateErr = tt.err

				obj, created, err := newStore(fake).Update(ctx, "folder-f1", mergePatch("folder-f1", preloadPatch), nil, nil, false, &metav1.UpdateOptions{})
				require.Same(t, tt.err, err)
				require.Nil(t, obj)
				require.False(t, created)

				require.Len(t, fake.updates, 1)
				require.Empty(t, fake.creates)
			})
		}
	})

	t.Run("an error from applying the update to the placeholder is returned unchanged", func(t *testing.T) {
		fake := newFakeDashboardPreferencesStore()
		rejected := apierrors.NewBadRequest("rejected")
		// A patch that admission refuses fails like this, but only once the old object has a UID.
		rejectedPatch := rest.DefaultUpdatedObjectInfo(nil, func(_ context.Context, _, oldObj runtime.Object) (runtime.Object, error) {
			if requireDashboardPreferences(t, oldObj).UID == "" {
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
				fake := newFakeDashboardPreferencesStore()

				_, created, err := newStore(fake).Update(ctx, name, mergePatch(name, preloadPatch), nil, nil, false, &metav1.UpdateOptions{})
				require.True(t, apierrors.IsBadRequest(err), "expected a BadRequest, got %v", err)
				require.ErrorContains(t, err, "invalid dashboard preferences name")
				require.False(t, created)

				require.Empty(t, fake.creates)
			})
		}
	})

	// The create validation is where admission authorizes and checks the name and folder, so it has
	// to see the patched object, scope included.
	t.Run("the create validation judges the object a patch creates", func(t *testing.T) {
		fake := newFakeDashboardPreferencesStore()
		rejected := apierrors.NewBadRequest("rejected")
		var validated *dashv2beta1.DashboardPreferences
		createValidation := func(_ context.Context, obj runtime.Object) error {
			validated = requireDashboardPreferences(t, obj)
			return rejected
		}

		obj, created, err := newStore(fake).Update(ctx, "user-u1", mergePatch("user-u1", preloadPatch), createValidation, nil, false, &metav1.UpdateOptions{})
		require.Same(t, rejected, err)
		require.Nil(t, obj)
		require.False(t, created)

		require.NotNil(t, validated)
		require.Equal(t, new("u1"), validated.Spec.UserUID)
		require.Equal(t, patchedDashboard, validated.Spec.Dashboard)
		require.Empty(t, fake.items)
	})

	// Admission runs inside the store's validations, so every store call needs both of them.
	t.Run("both validations reach the store on the first update and on the retry after a lost create race", func(t *testing.T) {
		winner := stored("user-u1")
		winner.Spec.UserUID = new("u1")
		fake := newFakeDashboardPreferencesStore()
		fake.concurrent = winner
		var ran []string
		createValidation := func(_ context.Context, obj runtime.Object) error {
			ran = append(ran, "create "+requireDashboardPreferences(t, obj).Name)
			return nil
		}
		updateValidation := func(_ context.Context, obj, _ runtime.Object) error {
			ran = append(ran, "update "+requireDashboardPreferences(t, obj).Name)
			return nil
		}

		_, created, err := newStore(fake).Update(ctx, "user-u1", mergePatch("user-u1", preloadPatch), createValidation, updateValidation, false, &metav1.UpdateOptions{})
		require.NoError(t, err)
		require.False(t, created)
		// The create that lost was judged as a create, and the retry as an update of the winner.
		require.Equal(t, []string{"create user-u1", "update user-u1"}, ran)

		require.Len(t, fake.updates, 2)
		for i, call := range fake.updates {
			ran = nil
			require.NotNil(t, call.createValidation, "update %d", i)
			require.NotNil(t, call.updateValidation, "update %d", i)
			require.NoError(t, call.createValidation(ctx, winner))
			require.NoError(t, call.updateValidation(ctx, winner, winner))
			require.Equal(t, []string{"create user-u1", "update user-u1"}, ran, "update %d", i)
		}
	})

	t.Run("an error from the update validation is returned unchanged and nothing is created", func(t *testing.T) {
		existing := stored("user-u1")
		existing.Spec.UserUID = new("u1")
		fake := newFakeDashboardPreferencesStore(existing)
		rejected := errors.New("update rejected")
		updateValidation := func(context.Context, runtime.Object, runtime.Object) error { return rejected }

		obj, created, err := newStore(fake).Update(ctx, "user-u1", mergePatch("user-u1", preloadPatch), nil, updateValidation, false, &metav1.UpdateOptions{})
		require.Same(t, rejected, err)
		require.Nil(t, obj)
		require.False(t, created)

		require.Len(t, fake.updates, 1)
		require.Empty(t, fake.creates)
		require.Same(t, existing, fake.items["user-u1"])
		require.Nil(t, existing.Spec.Dashboard)
	})

	// Without this wrapper the patcher answers NotFound, and Create would refuse the resourceVersion with
	// a 500.
	t.Run("a patch with a resourceVersion on a missing object is not found", func(t *testing.T) {
		fake := newFakeDashboardPreferencesStore()
		const patch = `{"metadata":{"resourceVersion":"1"},"spec":{"dashboard":{"preload":true}}}`

		obj, created, err := newStore(fake).Update(ctx, "user-u1", mergePatch("user-u1", patch), nil, nil, false, &metav1.UpdateOptions{})
		require.True(t, apierrors.IsNotFound(err), "expected NotFound, got %v", err)
		require.True(t, isDashboardPreferencesNotFound(err, "user-u1"), "expected the object's own NotFound, got %v", err)
		require.Nil(t, obj)
		require.False(t, created)

		require.Len(t, fake.updates, 1)
		require.Empty(t, fake.creates)
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
				fake := newFakeDashboardPreferencesStore()

				_, created, err := newStore(fake).Update(ctx, "namespace", mergePatch("namespace", preloadPatch), nil, nil, false, tt.options)
				require.NoError(t, err)
				require.True(t, created)

				require.Len(t, fake.creates, 1)
				require.Equal(t, tt.want, fake.creates[0].options)
			})
		}
	})
}

func TestDashboardPreferencesStorageNewEmptyDashboardPreferences(t *testing.T) {
	ctx := k8srequest.WithNamespace(context.Background(), "stacks-1")
	gvk := dashv2beta1.DashboardPreferencesResourceInfo.GroupVersionKind()
	store := newDashboardPreferencesStorage(newFakeDashboardPreferencesStore(), gvk, nil)

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
			obj, err := store.newEmptyDashboardPreferences(ctx, tt.name)
			require.NoError(t, err)

			require.Equal(t, gvk, obj.GroupVersionKind())
			require.Equal(t, tt.name, obj.Name)
			require.Equal(t, "stacks-1", obj.Namespace)
			require.Equal(t, tt.wantAnnotations, obj.GetAnnotations())
			require.Equal(t, dashv2beta1.DashboardPreferencesSpec{UserUID: tt.wantUserUID}, obj.Spec)
			// The UID hashes the kind, namespace and name, so it only matches when it is set after them.
			require.Equal(t, gapiutil.CalculateClusterWideUID(obj), obj.UID)
		})
	}
}

// A wrapper that picked these up from the store would expose or delete other users' user tier objects.
func TestDashboardPreferencesStorageHidesWatchAndDeleteCollection(t *testing.T) {
	wrapped := &watchableDashboardPreferencesStore{newFakeDashboardPreferencesStore()}
	require.Implements(t, (*rest.Watcher)(nil), wrapped)
	require.Implements(t, (*rest.CollectionDeleter)(nil), wrapped)

	store := newDashboardPreferencesStorage(wrapped, dashv2beta1.DashboardPreferencesResourceInfo.GroupVersionKind(), nil)

	require.NotImplements(t, (*rest.Watcher)(nil), store)
	require.NotImplements(t, (*rest.CollectionDeleter)(nil), store)
}

func TestIsDashboardPreferencesNotFound(t *testing.T) {
	gr := dashv2beta1.DashboardPreferencesResourceInfo.GroupResource()

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
		{name: "not an API error", err: errors.New("dashboard preferences not found")},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, isDashboardPreferencesNotFound(tt.err, "folder-f1"))
		})
	}
}

func TestDashboardPreferencesStorageList(t *testing.T) {
	ctx := k8srequest.WithNamespace(context.Background(), "stacks-1")
	gvk := dashv2beta1.DashboardPreferencesResourceInfo.GroupVersionKind()
	stored := map[string]*dashv2beta1.DashboardPreferences{}
	for _, obj := range []*dashv2beta1.DashboardPreferences{
		newDashboardPreferences("namespace", "", nil),
		newDashboardPreferences("user-u1", "", new("u1")),
		newDashboardPreferences("user-u2", "", new("u2")),
		newDashboardPreferences("folder-f1", "f1", nil),
		newDashboardPreferences("folder-f2", "f2", nil),
	} {
		stored[obj.Name] = obj
	}
	// What the store answers for the folder tier label.
	folderTier := [][]dashv2beta1.DashboardPreferences{{*stored["folder-f1"], *stored["folder-f2"]}}
	newAccessClient := func() *dashboardPreferencesAccessClient {
		return &dashboardPreferencesAccessClient{grants: map[string][]string{"f1": {utils.VerbGet}}}
	}
	nameIs := func(name string) *metainternalversion.ListOptions {
		return &metainternalversion.ListOptions{FieldSelector: fields.OneTermEqualSelector("metadata.name", name)}
	}

	u1 := dashboardPreferencesRequester(authlib.TypeUser, "u1", identity.RoleViewer)
	u3 := dashboardPreferencesRequester(authlib.TypeUser, "u3", identity.RoleViewer)
	serviceAccount := dashboardPreferencesRequester(authlib.TypeServiceAccount, "sa", identity.RoleAdmin)
	serviceAccountU1 := dashboardPreferencesRequester(authlib.TypeServiceAccount, "u1", identity.RoleAdmin)
	render := dashboardPreferencesRequester(authlib.TypeRenderService, "", identity.RoleViewer)
	grafanaAdmin := dashboardPreferencesRequester(authlib.TypeUser, "u1", identity.RoleAdmin)
	grafanaAdmin.IsGrafanaAdmin = true
	// Grafana admins pass the namespace authorizer for every namespace.
	otherNamespace := dashboardPreferencesRequester(authlib.TypeUser, "u1", identity.RoleAdmin)
	otherNamespace.IsGrafanaAdmin = true
	otherNamespace.Namespace = "stacks-2"

	t.Run("returns only what the caller can read", func(t *testing.T) {
		tests := []struct {
			name      string
			requester identity.Requester
			options   *metainternalversion.ListOptions
			want      []string
			wantGets  []string
			wantLists int
		}{
			{name: "a user gets the org tier, their user tier and the folders they can read", requester: u1, want: []string{"namespace", "user-u1", "folder-f1"}, wantGets: []string{"namespace", "user-u1"}, wantLists: 1},
			// Clients such as kubectl send a limit, and everything the caller can read fits in one page.
			{name: "the limit is ignored", requester: u1, options: &metainternalversion.ListOptions{Limit: 1}, want: []string{"namespace", "user-u1", "folder-f1"}, wantGets: []string{"namespace", "user-u1"}, wantLists: 1},
			{name: "empty selectors select everything", requester: u1, options: &metainternalversion.ListOptions{LabelSelector: labels.Everything(), FieldSelector: fields.Everything()}, want: []string{"namespace", "user-u1", "folder-f1"}, wantGets: []string{"namespace", "user-u1"}, wantLists: 1},
			{name: "a tier that isn't stored is skipped", requester: u3, want: []string{"namespace", "folder-f1"}, wantGets: []string{"namespace", "user-u3"}, wantLists: 1},
			{name: "a service account gets no user tier", requester: serviceAccount, want: []string{"namespace", "folder-f1"}, wantGets: []string{"namespace"}, wantLists: 1},
			// The authorizer turns render identities away, but one that reached storage gets the org tier only.
			{name: "another identity gets only the org tier", requester: render, want: []string{"namespace"}, wantGets: []string{"namespace"}},
			{name: "a requester from another namespace gets nothing", requester: otherNamespace, want: []string{}},

			// The authorizer sees the selected name only when it is a valid path segment, so the tier rules
			// apply here too.
			{name: "selecting the caller's user tier", requester: u1, options: nameIs("user-u1"), want: []string{"user-u1"}, wantGets: []string{"user-u1"}},
			{name: "selecting with ==", requester: u1, options: &metainternalversion.ListOptions{FieldSelector: fields.ParseSelectorOrDie("metadata.name==user-u1")}, want: []string{"user-u1"}, wantGets: []string{"user-u1"}},
			{name: "selecting another user's tier", requester: u1, options: nameIs("user-u2"), want: []string{}},
			{name: "a service account with the owner's UID is not the owner", requester: serviceAccountU1, options: nameIs("user-u1"), want: []string{}},
			{name: "selecting the org tier", requester: u1, options: nameIs("namespace"), want: []string{"namespace"}, wantGets: []string{"namespace"}},
			{name: "selecting the org tier from another namespace", requester: otherNamespace, options: nameIs("namespace"), want: []string{}},
			{name: "selecting a readable folder tier", requester: u1, options: nameIs("folder-f1"), want: []string{"folder-f1"}, wantGets: []string{"folder-f1"}},
			{name: "selecting an unreadable folder tier", requester: u1, options: nameIs("folder-f2"), want: []string{}, wantGets: []string{"folder-f2"}},
			{name: "selecting a folder tier from another namespace", requester: otherNamespace, options: nameIs("folder-f1"), want: []string{}},
			{name: "selecting a tier that isn't stored", requester: u3, options: nameIs("user-u3"), want: []string{}, wantGets: []string{"user-u3"}},
			{name: "selecting a name outside every tier", requester: u1, options: nameIs("bogus"), want: []string{}},
		}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				store := newDashboardPreferencesListStore(t, stored, folderTier)

				obj, err := newDashboardPreferencesStorage(store, gvk, newAccessClient()).List(identity.WithRequester(ctx, tt.requester), tt.options)
				require.NoError(t, err)

				require.Equal(t, tt.want, dashboardPreferencesNames(requireFilteredDashboardPreferencesList(t, obj).Items))
				require.Equal(t, tt.wantGets, store.gets)
				// Listing only by the tier label keeps other users' objects out of reach.
				require.Len(t, store.lists, tt.wantLists)
				for _, options := range store.lists {
					require.NotNil(t, options)
					require.NotNil(t, options.LabelSelector)
					require.Equal(t, "dashboard.grafana.app/preferences-tier=folder", options.LabelSelector.String())
					require.Equal(t, int64(dashboardPreferencesListPageSize), options.Limit)
				}
			})
		}
	})

	// The apiserver also serves this list across all namespaces, and the namespace authorizer has no
	// opinion on it. The tier rules' namespace checks keep it from reaching the store, which would scan
	// every org.
	t.Run("a list across all namespaces reads nothing", func(t *testing.T) {
		allNamespaces := k8srequest.WithNamespace(context.Background(), "")
		tests := []struct {
			name      string
			requester identity.Requester
			options   *metainternalversion.ListOptions
		}{
			{name: "a viewer", requester: u1},
			{name: "a viewer selecting a folder tier", requester: u1, options: nameIs("folder-f1")},
			{name: "a Grafana admin", requester: grafanaAdmin},
			{name: "a Grafana admin selecting a folder tier", requester: grafanaAdmin, options: nameIs("folder-f1")},
			{name: "a service account", requester: serviceAccount},
			{name: "a service account selecting a folder tier", requester: serviceAccount, options: nameIs("folder-f1")},
		}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				accessClient := newAccessClient()
				store := newDashboardPreferencesListStore(t, stored, folderTier)

				obj, err := newDashboardPreferencesStorage(store, gvk, accessClient).List(identity.WithRequester(allNamespaces, tt.requester), tt.options)
				require.NoError(t, err)

				require.Empty(t, dashboardPreferencesNames(requireFilteredDashboardPreferencesList(t, obj).Items))
				require.Empty(t, store.gets)
				require.Empty(t, store.lists)
				require.Empty(t, accessClient.batchRequests)
			})
		}
	})

	t.Run("checks read access to every folder in one batch, as the caller", func(t *testing.T) {
		accessClient := newAccessClient()
		store := newDashboardPreferencesListStore(t, stored, folderTier)

		_, err := newDashboardPreferencesStorage(store, gvk, accessClient).List(identity.WithRequester(ctx, u1), nil)
		require.NoError(t, err)

		require.Len(t, accessClient.batchRequests, 1)
		request := accessClient.batchRequests[0]
		require.Equal(t, "stacks-1", request.Namespace)
		// FilterAuthorized numbers the checks by position.
		for i := range request.Checks {
			request.Checks[i].CorrelationID = ""
		}
		require.Equal(t, []authlib.BatchCheckItem{
			{Verb: "get", Group: "folder.grafana.app", Resource: "folders", Name: "f1", Folder: "f1"},
			{Verb: "get", Group: "folder.grafana.app", Resource: "folders", Name: "f2", Folder: "f2"},
		}, request.Checks)
		// A check made as the service identity would pass on the service's own permissions.
		require.Equal(t, []string{u1.GetUID()}, accessClient.callers)
	})

	// The tier label only indexes the folder tier: an object belongs to it only when its folder
	// annotation is the folder its name gives.
	t.Run("the folder tier holds only objects whose annotation matches their name", func(t *testing.T) {
		accessClient := &dashboardPreferencesAccessClient{grants: map[string][]string{
			"f1":      {utils.VerbGet},
			"f3":      {utils.VerbGet},
			"f4":      {utils.VerbGet},
			"general": {utils.VerbGet},
		}}
		store := newDashboardPreferencesListStore(t, nil, [][]dashv2beta1.DashboardPreferences{{
			*newDashboardPreferences("folder-f1", "f1", nil),
			*newDashboardPreferences("folder-f3", "f1", nil),
			*newDashboardPreferences("folder-f4", "", nil),
			*newDashboardPreferences("folder-general", "general", nil),
			*newDashboardPreferences("namespace", "", nil),
			*newDashboardPreferences("user-u1", "", new("u1")),
		}})

		items, err := newDashboardPreferencesStorage(store, gvk, accessClient).visibleFolderTier(identity.WithRequester(ctx, u1), u1, "stacks-1")
		require.NoError(t, err)

		require.Equal(t, []string{"folder-f1"}, dashboardPreferencesNames(items))
		require.Len(t, accessClient.batchRequests, 1)
		require.Len(t, accessClient.batchRequests[0].Checks, 1)
	})

	t.Run("reads at most 20 pages of the folder tier", func(t *testing.T) {
		tests := []struct {
			name     string
			pages    int
			wantWarn bool
		}{
			{name: "more pages than the cap", pages: 25, wantWarn: true},
			// Nothing is left out when the last page fits under the cap.
			{name: "exactly the cap", pages: 20},
		}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				accessClient := &dashboardPreferencesAccessClient{grants: map[string][]string{}}
				pages := make([][]dashv2beta1.DashboardPreferences, tt.pages)
				for i := range pages {
					folderUID := fmt.Sprintf("f%d", i)
					pages[i] = []dashv2beta1.DashboardPreferences{*newDashboardPreferences("folder-"+folderUID, folderUID, nil)}
					accessClient.grants[folderUID] = []string{utils.VerbGet}
				}
				store := newDashboardPreferencesListStore(t, nil, pages)
				var logs bytes.Buffer
				logCtx := logging.Context(identity.WithRequester(ctx, u1), logging.NewSLogLogger(slog.NewJSONHandler(&logs, nil)))

				obj, err := newDashboardPreferencesStorage(store, gvk, accessClient).List(logCtx, nil)
				require.NoError(t, err)

				want := make([]string, 0, 20)
				wantContinues := make([]string, 0, 20)
				for i := range 20 {
					want = append(want, fmt.Sprintf("folder-f%d", i))
					wantContinues = append(wantContinues, store.continueToken(i))
				}
				require.Equal(t, want, dashboardPreferencesNames(requireFilteredDashboardPreferencesList(t, obj).Items))
				continues := make([]string, 0, len(store.lists))
				for _, options := range store.lists {
					continues = append(continues, options.Continue)
				}
				require.Equal(t, wantContinues, continues)

				if !tt.wantWarn {
					require.Empty(t, logs.String())
					return
				}
				var record map[string]any
				require.NoError(t, json.Unmarshal(logs.Bytes(), &record), "expected one log record, got %s", logs.String())
				require.Equal(t, "WARN", record["level"])
				require.Equal(t, "dashboard preferences list reached the folder tier page cap and may have left out folders", record["msg"])
				require.Equal(t, "stacks-1", record["namespace"])
				require.EqualValues(t, 20, record["pages"])
			})
		}
	})

	// The authorizer already limited what they may do, and folder and user cleanup must find every object.
	t.Run("an access-policy caller gets the store's list unchanged", func(t *testing.T) {
		_, service := identity.WithServiceIdentity(context.Background(), 1)
		_, provisioning, err := identity.WithProvisioningIdentity(context.Background(), "stacks-1")
		require.NoError(t, err)

		for _, caller := range []struct {
			name      string
			requester identity.Requester
		}{
			{name: "the service identity", requester: service},
			{name: "the provisioning identity", requester: provisioning},
			{name: "another service's token", requester: dashboardPreferencesToken("dashboard.grafana.app/dashboardpreferences:*")},
		} {
			t.Run(caller.name, func(t *testing.T) {
				options := &metainternalversion.ListOptions{Limit: 2, Continue: "c1"}
				want := &dashv2beta1.DashboardPreferencesList{
					ListMeta: metav1.ListMeta{Continue: "c2"},
					Items:    []dashv2beta1.DashboardPreferences{*stored["user-u1"], *stored["user-u2"]},
				}
				store := grafanarest.NewMockStorage(t)
				store.EXPECT().List(mock.Anything, mock.MatchedBy(func(got *metainternalversion.ListOptions) bool {
					return got == options
				})).Return(want, nil).Once()

				obj, err := newDashboardPreferencesStorage(store, gvk, newAccessClient()).List(identity.WithRequester(ctx, caller.requester), options)
				require.NoError(t, err)
				require.Same(t, want, obj)
			})
		}
	})

	t.Run("unsupported list options are a bad request", func(t *testing.T) {
		const unsupportedFieldSelector = "only a single metadata.name=<name> fieldSelector is supported for dashboard preferences"
		tests := []struct {
			name    string
			options *metainternalversion.ListOptions
			wantErr string
		}{
			// A store's token encodes the next object's name or an offset into the unfiltered list.
			{name: "a continue token", options: &metainternalversion.ListOptions{Continue: "abc"}, wantErr: "continue is not supported for dashboard preferences"},
			{name: "a label selector", options: &metainternalversion.ListOptions{LabelSelector: labels.SelectorFromSet(labels.Set{"grafana.app/folder": "f1"})}, wantErr: "labelSelector is not supported for dashboard preferences"},
			{name: "a name inequality", options: &metainternalversion.ListOptions{FieldSelector: fields.OneTermNotEqualSelector("metadata.name", "user-u2")}, wantErr: unsupportedFieldSelector},
			{name: "more than one requirement", options: &metainternalversion.ListOptions{FieldSelector: fields.ParseSelectorOrDie("metadata.name=user-u1,metadata.namespace=stacks-1")}, wantErr: unsupportedFieldSelector},
			{name: "a field other than the name", options: &metainternalversion.ListOptions{FieldSelector: fields.OneTermEqualSelector("metadata.namespace", "stacks-1")}, wantErr: unsupportedFieldSelector},
		}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				store := newDashboardPreferencesListStore(t, stored, folderTier)

				obj, err := newDashboardPreferencesStorage(store, gvk, newAccessClient()).List(identity.WithRequester(ctx, u1), tt.options)
				require.True(t, apierrors.IsBadRequest(err), "expected a BadRequest, got %v", err)
				require.ErrorContains(t, err, tt.wantErr)
				require.Nil(t, obj)

				require.Empty(t, store.gets)
				require.Empty(t, store.lists)
			})
		}
	})

	t.Run("an error other than NotFound is returned", func(t *testing.T) {
		boom := errors.New("boom")
		tests := []struct {
			name     string
			getErr   error
			listErr  error
			batchErr error
		}{
			{name: "from a get", getErr: boom},
			{name: "from a list of the folder tier", listErr: boom},
			{name: "from a folder check", batchErr: boom},
		}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				store := newDashboardPreferencesListStore(t, stored, folderTier)
				store.getErr = tt.getErr
				store.listErr = tt.listErr
				accessClient := newAccessClient()
				accessClient.batchErr = tt.batchErr

				obj, err := newDashboardPreferencesStorage(store, gvk, accessClient).List(identity.WithRequester(ctx, u1), nil)
				require.ErrorIs(t, err, boom)
				require.Nil(t, obj)
			})
		}
	})

	// A batch check reports a failure on one item and still answers the others, and a list that left that
	// folder out would look like a denial, while a named get of it fails.
	t.Run("a folder whose check failed is an error", func(t *testing.T) {
		errF1, errF2 := errors.New("f1 check failed"), errors.New("f2 check failed")
		tests := []struct {
			name       string
			options    *metainternalversion.ListOptions
			itemErrs   map[string]error
			wantErr    error
			wantFolder string
			want       []string
		}{
			{name: "a folder the caller can read", itemErrs: map[string]error{"f1": errF1}, wantErr: errF1, wantFolder: "f1"},
			{name: "a folder the caller can't read", itemErrs: map[string]error{"f2": errF2}, wantErr: errF2, wantFolder: "f2"},
			{name: "the first of several", itemErrs: map[string]error{"f1": errF1, "f2": errF2}, wantErr: errF1, wantFolder: "f1"},
			{name: "the selected folder", options: nameIs("folder-f1"), itemErrs: map[string]error{"f1": errF1}, wantErr: errF1, wantFolder: "f1"},

			// A denial is not a failure.
			{name: "a folder that was denied is left out", want: []string{"namespace", "user-u1", "folder-f1"}},
			{name: "a selected folder that was denied is left out", options: nameIs("folder-f2"), want: []string{}},
		}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				store := newDashboardPreferencesListStore(t, stored, folderTier)
				accessClient := newAccessClient()
				accessClient.batchItemErrs = tt.itemErrs
				var logs bytes.Buffer
				logCtx := logging.Context(identity.WithRequester(ctx, u1), logging.NewSLogLogger(slog.NewJSONHandler(&logs, nil)))

				obj, err := newDashboardPreferencesStorage(store, gvk, accessClient).List(logCtx, tt.options)

				if tt.wantErr != nil {
					require.ErrorIs(t, err, tt.wantErr)
					require.ErrorContains(t, err, "folder access could not be checked")
					// The apiserver sends a List error's text to the client, and the cause can be the access
					// backend's raw message, which can carry datastore details.
					require.NotContains(t, err.Error(), tt.wantErr.Error())
					require.Nil(t, obj)

					var record map[string]any
					require.NoError(t, json.Unmarshal(logs.Bytes(), &record), "expected one log record, got %s", logs.String())
					require.Equal(t, "ERROR", record["level"])
					require.Equal(t, "stacks-1", record["namespace"])
					require.Equal(t, tt.wantFolder, record["folder"])
					require.Equal(t, tt.wantErr.Error(), record["err"])
					return
				}
				require.NoError(t, err)
				require.Equal(t, tt.want, dashboardPreferencesNames(requireFilteredDashboardPreferencesList(t, obj).Items))
			})
		}
	})

	// Like checkDashboardPreferencesFolderAccess, which denies every folder without one.
	t.Run("without an access client no folder tier is read", func(t *testing.T) {
		store := newDashboardPreferencesListStore(t, stored, folderTier)

		obj, err := newDashboardPreferencesStorage(store, gvk, nil).List(identity.WithRequester(ctx, u1), nil)
		require.NoError(t, err)

		require.Equal(t, []string{"namespace", "user-u1"}, dashboardPreferencesNames(requireFilteredDashboardPreferencesList(t, obj).Items))
		require.Empty(t, store.lists)
	})

	t.Run("a request without a requester fails", func(t *testing.T) {
		store := newDashboardPreferencesListStore(t, stored, folderTier)

		obj, err := newDashboardPreferencesStorage(store, gvk, newAccessClient()).List(ctx, nil)
		require.Error(t, err)
		require.Nil(t, obj)

		require.Empty(t, store.gets)
		require.Empty(t, store.lists)
	})
}

// A store's continue token encodes the next object's name or an offset into the unfiltered list, so a
// filtered list must never pass one on.
func requireFilteredDashboardPreferencesList(t *testing.T, obj runtime.Object) *dashv2beta1.DashboardPreferencesList {
	t.Helper()
	list, ok := obj.(*dashv2beta1.DashboardPreferencesList)
	require.True(t, ok, "expected a dashboard preferences list, got %T", obj)
	require.Empty(t, list.Continue)
	require.Nil(t, list.RemainingItemCount)
	// The store's lists encode no items as [], and clients expect the same here.
	require.NotNil(t, list.Items)
	return list
}

func dashboardPreferencesNames(items []dashv2beta1.DashboardPreferences) []string {
	names := make([]string, 0, len(items))
	for _, item := range items {
		names = append(names, item.Name)
	}
	return names
}

func requireDashboardPreferences(t *testing.T, obj runtime.Object) *dashv2beta1.DashboardPreferences {
	t.Helper()
	preferences, ok := obj.(*dashv2beta1.DashboardPreferences)
	require.True(t, ok, "expected dashboard preferences, got %T", obj)
	return preferences
}

type dashboardPreferencesUpdateCall struct {
	name             string
	forceAllowCreate bool
	options          *metav1.UpdateOptions
	// Funcs can't be compared, so a test tells them apart by calling them.
	createValidation rest.ValidateObjectFunc
	updateValidation rest.ValidateObjectUpdateFunc
}

type dashboardPreferencesCreateCall struct {
	obj     *dashv2beta1.DashboardPreferences
	options *metav1.CreateOptions
}

// fakeDashboardPreferencesStore stands in for the registry store: it keeps objects by name, records the
// calls the wrapper makes, and fails the way the store does. Any other call panics.
type fakeDashboardPreferencesStore struct {
	grafanarest.Storage
	items map[string]*dashv2beta1.DashboardPreferences

	// Returned by every Update, in place of looking the object up.
	updateErr error
	// Stored by another request just before the next Create runs.
	concurrent *dashv2beta1.DashboardPreferences

	updates []dashboardPreferencesUpdateCall
	creates []dashboardPreferencesCreateCall
}

func newFakeDashboardPreferencesStore(items ...*dashv2beta1.DashboardPreferences) *fakeDashboardPreferencesStore {
	f := &fakeDashboardPreferencesStore{items: map[string]*dashv2beta1.DashboardPreferences{}}
	for _, item := range items {
		f.items[item.Name] = item
	}
	return f
}

func (f *fakeDashboardPreferencesStore) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	f.updates = append(f.updates, dashboardPreferencesUpdateCall{
		name:             name,
		forceAllowCreate: forceAllowCreate,
		options:          options,
		createValidation: createValidation,
		updateValidation: updateValidation,
	})
	if f.updateErr != nil {
		return nil, false, f.updateErr
	}

	// The registry store hands the transformer an empty object when nothing is stored.
	old, exists := f.items[name]
	if !exists {
		old = &dashv2beta1.DashboardPreferences{}
	}
	obj, err := objInfo.UpdatedObject(ctx, old)
	if err != nil {
		return nil, false, err
	}
	preferences, ok := obj.(*dashv2beta1.DashboardPreferences)
	if !ok {
		return nil, false, fmt.Errorf("expected dashboard preferences, got %T", obj)
	}
	// Like the registry store, it judges the updated object last, as a create when nothing was stored.
	if exists && updateValidation != nil {
		if err := updateValidation(ctx, preferences.DeepCopyObject(), old.DeepCopyObject()); err != nil {
			return nil, false, err
		}
	}
	if !exists && createValidation != nil {
		if err := createValidation(ctx, preferences.DeepCopyObject()); err != nil {
			return nil, false, err
		}
	}
	f.items[name] = preferences
	return preferences, !exists, nil
}

func (f *fakeDashboardPreferencesStore) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	preferences, ok := obj.(*dashv2beta1.DashboardPreferences)
	if !ok {
		return nil, fmt.Errorf("expected dashboard preferences, got %T", obj)
	}
	f.creates = append(f.creates, dashboardPreferencesCreateCall{obj: preferences, options: options})

	if f.concurrent != nil {
		f.items[f.concurrent.Name] = f.concurrent
		f.concurrent = nil
	}
	if createValidation != nil {
		if err := createValidation(ctx, preferences.DeepCopyObject()); err != nil {
			return nil, err
		}
	}
	if _, exists := f.items[preferences.Name]; exists {
		return nil, apierrors.NewAlreadyExists(dashv2beta1.DashboardPreferencesResourceInfo.GroupResource(), preferences.Name)
	}
	// Like the registry store, it answers with a new object, so a caller that returns the object it
	// passed in instead of the answer is caught.
	stored := preferences.DeepCopy()
	f.items[stored.Name] = stored
	return stored, nil
}

// dashboardPreferencesListStore is a mock store that answers Get from stored objects and List from pages
// of the folder tier, and records the names it gets and the options of every list. Any other call
// fails the test.
type dashboardPreferencesListStore struct {
	*grafanarest.MockStorage
	gets  []string
	lists []*metainternalversion.ListOptions

	// Returned by every Get or List in place of an answer.
	getErr  error
	listErr error
}

func newDashboardPreferencesListStore(t *testing.T, stored map[string]*dashv2beta1.DashboardPreferences, folderTier [][]dashv2beta1.DashboardPreferences) *dashboardPreferencesListStore {
	s := &dashboardPreferencesListStore{MockStorage: grafanarest.NewMockStorage(t)}
	s.EXPECT().Get(mock.Anything, mock.Anything, mock.Anything).RunAndReturn(func(_ context.Context, name string, _ *metav1.GetOptions) (runtime.Object, error) {
		s.gets = append(s.gets, name)
		if s.getErr != nil {
			return nil, s.getErr
		}
		obj, ok := stored[name]
		if !ok {
			return nil, apierrors.NewNotFound(dashv2beta1.DashboardPreferencesResourceInfo.GroupResource(), name)
		}
		return obj.DeepCopy(), nil
	}).Maybe()
	s.EXPECT().List(mock.Anything, mock.Anything).RunAndReturn(func(_ context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
		s.lists = append(s.lists, options)
		if s.listErr != nil {
			return nil, s.listErr
		}
		page := 0
		if options != nil && options.Continue != "" {
			var err error
			if page, err = strconv.Atoi(options.Continue); err != nil {
				return nil, apierrors.NewBadRequest("invalid continue token")
			}
		}
		list := &dashv2beta1.DashboardPreferencesList{}
		if page < len(folderTier) {
			list.Items = folderTier[page]
		}
		// Like the store, every page but the last carries a continue token and a remaining count.
		if page+1 < len(folderTier) {
			remaining := 0
			for _, later := range folderTier[page+1:] {
				remaining += len(later)
			}
			list.Continue = s.continueToken(page + 1)
			list.RemainingItemCount = new(int64(remaining))
		}
		return list, nil
	}).Maybe()
	return s
}

// continueToken is the token that asks for the given page; the first page needs none.
func (*dashboardPreferencesListStore) continueToken(page int) string {
	if page == 0 {
		return ""
	}
	return strconv.Itoa(page)
}

// watchableDashboardPreferencesStore is a store that serves watch and deletecollection, as the registry
// store does.
type watchableDashboardPreferencesStore struct {
	*fakeDashboardPreferencesStore
}

func (*watchableDashboardPreferencesStore) Watch(context.Context, *metainternalversion.ListOptions) (watch.Interface, error) {
	return watch.NewEmptyWatch(), nil
}

func (*watchableDashboardPreferencesStore) DeleteCollection(context.Context, rest.ValidateObjectFunc, *metav1.DeleteOptions, *metainternalversion.ListOptions) (runtime.Object, error) {
	return nil, nil
}
