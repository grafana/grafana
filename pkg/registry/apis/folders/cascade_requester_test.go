package folders

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	apirequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	authlib "github.com/grafana/authlib/types"
	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// terminatingStore marks a folder terminating on delete, as a folder with finalizers does. It records
// what the folder looked like and which options the delete was sent with.
type terminatingStore struct {
	*fakeFolderStorage
	deleteErr     error
	requesterSeen *foldersv1.FolderCascadeDeleteRequester
	options       *metav1.DeleteOptions
}

func (s *terminatingStore) Delete(ctx context.Context, name string, v rest.ValidateObjectFunc, o *metav1.DeleteOptions) (runtime.Object, bool, error) {
	f := s.existing[name]
	s.options = o
	if v != nil {
		if err := v(ctx, f); err != nil {
			return nil, false, err
		}
	}
	if f.Status.CascadeDelete != nil {
		s.requesterSeen = f.Status.CascadeDelete.Requester
	}
	if s.deleteErr != nil {
		return nil, false, s.deleteErr
	}
	if p := o.Preconditions; p != nil && p.ResourceVersion != nil && *p.ResourceVersion != f.ResourceVersion {
		return nil, false, apierrors.NewConflict(foldersv1.FolderResourceInfo.GroupResource(), name, errors.New("stale"))
	}
	now := metav1.Now()
	f.DeletionTimestamp = &now
	return f, false, nil
}

// fakeStatusStore applies the update to the stored folder and bumps its version, as the status
// subresource does.
type fakeStatusStore struct {
	store  *terminatingStore
	err    error
	calls  int
	before func()
}

func (f *fakeStatusStore) New() runtime.Object { return &foldersv1.Folder{} }

func (f *fakeStatusStore) Update(ctx context.Context, name string, info rest.UpdatedObjectInfo, _ rest.ValidateObjectFunc, _ rest.ValidateObjectUpdateFunc, _ bool, _ *metav1.UpdateOptions) (runtime.Object, bool, error) {
	f.calls++
	if f.before != nil {
		f.before()
	}
	if f.err != nil {
		return nil, false, f.err
	}
	old, ok := f.store.existing[name]
	if !ok {
		return nil, false, apierrors.NewNotFound(foldersv1.FolderResourceInfo.GroupResource(), name)
	}
	obj, err := info.UpdatedObject(ctx, old.DeepCopy())
	if err != nil {
		return nil, false, err
	}
	updated := obj.(*foldersv1.Folder)
	updated.ResourceVersion = old.ResourceVersion + "1"
	f.store.existing[name] = updated
	return updated.DeepCopy(), false, nil
}

var (
	requesterUser = &identity.StaticRequester{Type: authlib.TypeUser, UserID: 7, UserUID: "fg57", OrgID: 1}
	requesterApp  = &identity.StaticRequester{Type: authlib.TypeAccessPolicy, UserUID: "controller", OrgID: 1}
)

func requesterCtx(user identity.Requester) context.Context {
	return identity.WithRequester(apirequest.WithNamespace(context.Background(), "default"), user)
}

func setRequesterToggles(t *testing.T, async bool) {
	t.Helper()
	setOpenFeatureToggles(t, map[string]bool{
		featuremgmt.FlagKubernetesFolderCascadeDelete:             true,
		featuremgmt.FlagFolderAsyncCascadeDeleteThroughController: async,
	})
}

func newRequesterStore() (*terminatingStore, *fakeStatusStore, *cascadeDeleteStorage) {
	root := newFolder("root")
	root.UID = "uid-1"
	root.ResourceVersion = "1"
	root.Finalizers = []string{foldersv1.CascadeDeleteFinalizer}
	store := &terminatingStore{fakeFolderStorage: &fakeFolderStorage{existing: map[string]*foldersv1.Folder{"root": root}}}
	status := &fakeStatusStore{store: store}
	return store, status, &cascadeDeleteStorage{Storage: store, accessClient: &recordingAccessClient{}, status: status}
}

func TestCascadeDelete_RecordsTheRequesterInStatus(t *testing.T) {
	setRequesterToggles(t, true)
	store, _, s := newRequesterStore()

	_, _, err := s.Delete(requesterCtx(requesterUser), "root", nil, forceDelete())
	require.NoError(t, err)

	got := store.existing["root"].Status.CascadeDelete
	require.NotNil(t, got)
	require.Equal(t, cascadeDeleteRequesterOf(requesterUser), got.Requester)
	require.Equal(t, foldersv1.FolderCascadeDeleteRequesterTypeUser, got.Requester.Type)
	require.Equal(t, "fg57", got.Requester.Identifier)
}

func TestCascadeDelete_StampsTheRequesterBeforeTheDelete(t *testing.T) {
	setRequesterToggles(t, true)
	store, _, s := newRequesterStore()

	_, _, err := s.Delete(requesterCtx(requesterUser), "root", nil, forceDelete())
	require.NoError(t, err)
	require.Equal(t, cascadeDeleteRequesterOf(requesterUser), store.requesterSeen)
	require.Equal(t, "11", *store.options.Preconditions.ResourceVersion, "the delete is pinned to the stamped version")
}

func TestCascadeDelete_ReplacesTheRequesterLeftByAFailedDelete(t *testing.T) {
	setRequesterToggles(t, true)
	store, _, s := newRequesterStore()
	stale := &foldersv1.FolderCascadeDeleteRequester{Sub: "user:1", Identifier: "first", Type: foldersv1.FolderCascadeDeleteRequesterTypeUser}
	store.existing["root"].Status.CascadeDelete = &foldersv1.FolderCascadeDeleteStatus{Requester: stale}

	_, _, err := s.Delete(requesterCtx(requesterUser), "root", nil, forceDelete())
	require.NoError(t, err)
	require.Equal(t, cascadeDeleteRequesterOf(requesterUser), store.existing["root"].Status.CascadeDelete.Requester)
}

func TestCascadeDelete_KeepsTheRequesterOfATerminatingFolder(t *testing.T) {
	setRequesterToggles(t, true)
	store, status, s := newRequesterStore()
	first := &foldersv1.FolderCascadeDeleteRequester{Sub: "user:1", Identifier: "first", Type: foldersv1.FolderCascadeDeleteRequesterTypeUser}
	store.existing["root"].Status.CascadeDelete = &foldersv1.FolderCascadeDeleteStatus{Requester: first}
	now := metav1.Now()
	store.existing["root"].DeletionTimestamp = &now

	_, _, err := s.Delete(requesterCtx(requesterUser), "root", nil, forceDelete())
	require.NoError(t, err)
	require.Zero(t, status.calls)
	require.Equal(t, first, store.existing["root"].Status.CascadeDelete.Requester)
}

func TestCascadeDelete_DoesNotRecordTheRequesterFor(t *testing.T) {
	t.Run("the async cascade being off", func(t *testing.T) {
		setRequesterToggles(t, false)
		store, status, s := newRequesterStore()
		store.existing["root"].Status.CascadeDelete = &foldersv1.FolderCascadeDeleteStatus{Requester: cascadeDeleteRequesterOf(requesterUser)}
		// Not forced, so with the async cascade off only the folder is deleted.
		_, _, err := s.Delete(requesterCtx(requesterUser), "root", nil, &metav1.DeleteOptions{})
		require.NoError(t, err)
		require.Zero(t, status.calls)
	})

	t.Run("a controller subfolder delete with the async cascade off", func(t *testing.T) {
		setRequesterToggles(t, false)
		store, status, s := newRequesterStore()
		now := metav1.Now()
		store.existing["root"].DeletionTimestamp = &now
		child := newFolder("child")
		child.Finalizers = []string{foldersv1.CascadeDeleteFinalizer}
		child.Annotations = map[string]string{utils.AnnoKeyFolder: "root"}
		child.Status.CascadeDelete = &foldersv1.FolderCascadeDeleteStatus{Requester: cascadeDeleteRequesterOf(requesterUser)}
		store.existing["child"] = child

		_, _, err := s.Delete(requesterCtx(requesterApp), "child", nil, forceDelete())
		require.NoError(t, err)
		require.Zero(t, status.calls)
	})

	t.Run("a dry run", func(t *testing.T) {
		setRequesterToggles(t, true)
		_, status, s := newRequesterStore()
		opts := forceDelete()
		opts.DryRun = []string{metav1.DryRunAll}
		_, _, err := s.Delete(requesterCtx(requesterUser), "root", nil, opts)
		require.NoError(t, err)
		require.Zero(t, status.calls)
	})

	t.Run("an identity that is not a user or service account", func(t *testing.T) {
		setRequesterToggles(t, true)
		_, status, s := newRequesterStore()
		_, _, err := s.Delete(requesterCtx(&identity.StaticRequester{Type: authlib.TypeAnonymous}), "root", nil, forceDelete())
		require.NoError(t, err)
		require.Zero(t, status.calls)
	})

	t.Run("a service identity such as the controller", func(t *testing.T) {
		setRequesterToggles(t, true)
		store, status, s := newRequesterStore()
		now := metav1.Now()
		store.existing["root"].DeletionTimestamp = &now
		child := newFolder("child")
		child.Finalizers = []string{foldersv1.CascadeDeleteFinalizer}
		child.Annotations = map[string]string{utils.AnnoKeyFolder: "root"}
		store.existing["child"] = child

		_, _, err := s.Delete(requesterCtx(requesterApp), "child", nil, forceDelete())
		require.NoError(t, err)
		require.Zero(t, status.calls)
	})
}

func TestCascadeDelete_FailedStampDoesNotStopTheDelete(t *testing.T) {
	setRequesterToggles(t, true)
	store, status, s := newRequesterStore()
	status.err = errors.New("boom")

	_, _, err := s.Delete(requesterCtx(requesterUser), "root", nil, forceDelete())
	require.NoError(t, err)
	require.NotNil(t, store.existing["root"].DeletionTimestamp, "the folder is deleted without a requester")
	require.Nil(t, store.requesterSeen)
}

func TestCascadeDelete_FailedStampKeepsTheFolderWhenARequesterIsLeftOver(t *testing.T) {
	setRequesterToggles(t, true)
	store, status, s := newRequesterStore()
	left := cascadeDeleteRequesterOf(requesterUser)
	store.existing["root"].Status.CascadeDelete = &foldersv1.FolderCascadeDeleteStatus{Requester: left}
	status.err = errors.New("boom")

	_, _, err := s.Delete(requesterCtx(requesterApp), "root", nil, forceDelete())
	require.Error(t, err)
	require.Nil(t, store.existing["root"].DeletionTimestamp, "the folder is not deleted under another identity's requester")
	require.Equal(t, left, store.existing["root"].Status.CascadeDelete.Requester)
}

func TestCascadeDelete_FailedStampWithTheCallersOwnLeftoverStillDeletes(t *testing.T) {
	setRequesterToggles(t, true)
	store, status, s := newRequesterStore()
	own := cascadeDeleteRequesterOf(requesterUser)
	store.existing["root"].Status.CascadeDelete = &foldersv1.FolderCascadeDeleteStatus{Requester: own}
	status.err = errors.New("boom")

	_, _, err := s.Delete(requesterCtx(requesterUser), "root", nil, forceDelete())
	require.NoError(t, err)
	require.NotNil(t, store.existing["root"].DeletionTimestamp)
	require.Equal(t, own, store.existing["root"].Status.CascadeDelete.Requester)
}

func TestCascadeDelete_FailedStampWithAnotherUsersLeftoverKeepsTheFolder(t *testing.T) {
	setRequesterToggles(t, true)
	store, status, s := newRequesterStore()
	store.existing["root"].Status.CascadeDelete = &foldersv1.FolderCascadeDeleteStatus{Requester: cascadeDeleteRequesterOf(requesterUser)}
	status.err = errors.New("boom")
	other := &identity.StaticRequester{Type: authlib.TypeUser, UserID: 8, UserUID: "other", OrgID: 1}

	_, _, err := s.Delete(requesterCtx(other), "root", nil, forceDelete())
	require.Error(t, err)
	require.Nil(t, store.existing["root"].DeletionTimestamp)
}

func TestCascadeDelete_FailedDeleteClearsTheRequester(t *testing.T) {
	setRequesterToggles(t, true)
	store, _, s := newRequesterStore()
	store.deleteErr = errors.New("boom")

	_, _, err := s.Delete(requesterCtx(requesterUser), "root", nil, forceDelete())
	require.Error(t, err)
	require.Nil(t, store.existing["root"].Status.CascadeDelete.Requester)
}

func TestCascadeDelete_ConcurrentChangeBeforeTheStampIsAConflict(t *testing.T) {
	setRequesterToggles(t, true)
	store, status, s := newRequesterStore()
	status.before = func() {
		changed := store.existing["root"].DeepCopy()
		changed.ResourceVersion = "2"
		store.existing["root"] = changed
	}

	_, _, err := s.Delete(requesterCtx(requesterUser), "root", nil, forceDelete())
	require.True(t, apierrors.IsConflict(err), "got %v", err)
	require.Nil(t, store.existing["root"].DeletionTimestamp)
}

func TestCascadeDelete_RejectedDeleteIsNotStamped(t *testing.T) {
	setRequesterToggles(t, true)
	_, status, s := newRequesterStore()
	reject := func(context.Context, runtime.Object) error {
		return apierrors.NewForbidden(foldersv1.FolderResourceInfo.GroupResource(), "root", errors.New("no"))
	}

	_, _, err := s.Delete(requesterCtx(requesterUser), "root", reject, forceDelete())
	require.True(t, apierrors.IsForbidden(err), "got %v", err)
	require.Zero(t, status.calls)
}

func TestCascadeDelete_ClearsARequesterLeftOnALiveFolder(t *testing.T) {
	setRequesterToggles(t, true)
	store, _, s := newRequesterStore()
	store.existing["root"].Status.CascadeDelete = &foldersv1.FolderCascadeDeleteStatus{Requester: cascadeDeleteRequesterOf(requesterUser)}

	_, _, err := s.Delete(requesterCtx(requesterApp), "root", nil, forceDelete())
	require.NoError(t, err)
	require.Nil(t, store.requesterSeen, "the delete is not attributed to a leftover requester")
	require.NotNil(t, store.existing["root"].DeletionTimestamp)
}

func TestCascadeDelete_ValidatesOnceWhenStamping(t *testing.T) {
	count := func(calls *int) rest.ValidateObjectFunc {
		return func(context.Context, runtime.Object) error { *calls++; return nil }
	}

	t.Run("a stamped delete", func(t *testing.T) {
		setRequesterToggles(t, true)
		_, _, s := newRequesterStore()
		var calls int
		_, _, err := s.Delete(requesterCtx(requesterUser), "root", count(&calls), forceDelete())
		require.NoError(t, err)
		require.Equal(t, 1, calls)
	})

	t.Run("a delete whose stamp failed", func(t *testing.T) {
		setRequesterToggles(t, true)
		_, status, s := newRequesterStore()
		status.err = errors.New("boom")
		var calls int
		_, _, err := s.Delete(requesterCtx(requesterUser), "root", count(&calls), forceDelete())
		require.NoError(t, err)
		require.Equal(t, 1, calls)
	})
}
