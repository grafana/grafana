package folders

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/validation"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	authlib "github.com/grafana/authlib/types"
	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func folderWithRequester(v string) *foldersv1.Folder {
	f := &foldersv1.Folder{}
	if v != "" {
		f.ObjectMeta = metav1.ObjectMeta{Annotations: map[string]string{annoKeyCascadeDeleteRequester: v}}
	}
	return f
}

func TestCascadeDeleteRequesterValue(t *testing.T) {
	v, err := cascadeDeleteRequesterValue(&identity.StaticRequester{Type: authlib.TypeUser, UserID: 42, UserUID: "fg57"})
	require.NoError(t, err)
	require.JSONEq(t, `{"sub":"user:42","identifier":"fg57","type":"user"}`, v)

	v, err = cascadeDeleteRequesterValue(&identity.StaticRequester{Type: authlib.TypeAccessPolicy})
	require.NoError(t, err)
	require.Empty(t, v)
}

func TestValidateCascadeDeleteRequester(t *testing.T) {
	require.NoError(t, validateCascadeDeleteRequester(folderWithRequester(""), folderWithRequester("")))
	require.Error(t, validateCascadeDeleteRequester(folderWithRequester("x"), folderWithRequester("")))
	require.NoError(t, validateCascadeDeleteRequester(folderWithRequester("x"), folderWithRequester("x")))
	require.Error(t, validateCascadeDeleteRequester(folderWithRequester("y"), folderWithRequester("x")))
	require.Error(t, validateCascadeDeleteRequester(folderWithRequester("x"), folderWithRequester("")))

	empty := &foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{Annotations: map[string]string{annoKeyCascadeDeleteRequester: ""}}}
	require.Error(t, validateCascadeDeleteRequester(empty, folderWithRequester("")))
}

func TestRestoreCascadeDeleteRequester(t *testing.T) {
	f := folderWithRequester("")
	restoreCascadeDeleteRequester(f, folderWithRequester("x"))
	require.Equal(t, "x", f.Annotations[annoKeyCascadeDeleteRequester])
}

const userAValue = `{"sub":"user:42","identifier":"fg57","type":"user"}`

var (
	userA        = &identity.StaticRequester{Type: authlib.TypeUser, UserID: 42, UserUID: "fg57"}
	accessPolicy = &identity.StaticRequester{Type: authlib.TypeAccessPolicy}
)

func finalizerFolder(name string) *foldersv1.Folder {
	f := newFolder(name)
	f.Finalizers = []string{foldersv1.CascadeDeleteFinalizer}
	return f
}

func terminatingFolder() *foldersv1.Folder {
	f := finalizerFolder("f")
	now := metav1.Now()
	f.DeletionTimestamp = &now
	return f
}

func annotatedFolder(f *foldersv1.Folder, v string) *foldersv1.Folder {
	f.Annotations = map[string]string{annoKeyCascadeDeleteRequester: v}
	return f
}

// terminatingStore mimics a folder with finalizers: Delete marks it terminating instead of removing it.
type terminatingStore struct {
	*fakeFolderStorage
	updates   int
	deleteErr error
	updateErr error
	// rejectLiveUpdates stands in for the API-version cap, which exempts terminating objects.
	rejectLiveUpdates bool
	deleteOptions     *metav1.DeleteOptions
	// afterDelete simulates another request landing between the delete and the stamp.
	afterDelete func(*terminatingStore)
}

func newTerminatingStore(f *foldersv1.Folder) *terminatingStore {
	return &terminatingStore{fakeFolderStorage: &fakeFolderStorage{existing: map[string]*foldersv1.Folder{"f": f}}}
}

func (s *terminatingStore) Delete(ctx context.Context, name string, validate rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	s.deleteOptions = options
	fol, ok := s.existing[name]
	if !ok {
		return nil, false, apierrors.NewNotFound(foldersv1.FolderResourceInfo.GroupResource(), name)
	}
	if s.deleteErr != nil {
		return nil, false, s.deleteErr
	}
	if validate != nil {
		if err := validate(ctx, fol); err != nil {
			return nil, false, err
		}
	}
	if len(options.DryRun) == 0 && fol.DeletionTimestamp == nil {
		now := metav1.Now()
		fol.DeletionTimestamp = &now
	}
	if s.afterDelete != nil {
		s.afterDelete(s)
	}
	return fol, false, nil
}

func (s *terminatingStore) Update(ctx context.Context, name string, info rest.UpdatedObjectInfo, cv rest.ValidateObjectFunc, uv rest.ValidateObjectUpdateFunc, force bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	s.updates++
	if s.updateErr != nil || (s.rejectLiveUpdates && s.existing[name].DeletionTimestamp == nil) {
		return nil, false, errors.Join(s.updateErr, errors.New("update rejected"))
	}
	return s.fakeFolderStorage.Update(ctx, name, info, cv, uv, force, options)
}

func (s *terminatingStore) requester() string {
	return s.existing["f"].Annotations[annoKeyCascadeDeleteRequester]
}

func forceDeleteAs(store *terminatingStore, user identity.Requester, options *metav1.DeleteOptions, validate rest.ValidateObjectFunc) error {
	cascade, _ := newDashboardCascade(store, &fakeCascadeSearcher{})
	_, _, err := cascade.Delete(identity.WithRequester(ctxWithNamespace(), user), "f", validate, options)
	return err
}

func TestCascadeDelete_RequesterStamp(t *testing.T) {
	dryRun := forceDelete()
	dryRun.DryRun = []string{metav1.DryRunAll}

	for name, tc := range map[string]struct {
		folder      *foldersv1.Folder
		user        identity.Requester
		options     *metav1.DeleteOptions
		wantUpdates int
		want        string
	}{
		"user stamps a live folder":                        {finalizerFolder("f"), userA, forceDelete(), 1, userAValue},
		"different user restamps a live folder":            {annotatedFolder(finalizerFolder("f"), `{"sub":"user:7"}`), userA, forceDelete(), 1, userAValue},
		"same user writes nothing":                         {annotatedFolder(finalizerFolder("f"), userAValue), userA, forceDelete(), 0, userAValue},
		"non-user clears a stale requester":                {annotatedFolder(finalizerFolder("f"), `{"sub":"user:7"}`), accessPolicy, forceDelete(), 1, ""},
		"non-user on an unannotated folder writes nothing": {finalizerFolder("f"), accessPolicy, forceDelete(), 0, ""},
		"terminating folder keeps its requester":           {annotatedFolder(terminatingFolder(), "first"), userA, forceDelete(), 0, "first"},
		"terminating folder without one is stamped":        {terminatingFolder(), userA, forceDelete(), 1, userAValue},
		"non-user on an unattributed terminating folder":   {terminatingFolder(), accessPolicy, forceDelete(), 0, ""},
		"dry-run on a live folder":                         {finalizerFolder("f"), userA, dryRun, 0, ""},
		"dry-run on a terminating folder":                  {terminatingFolder(), userA, dryRun, 0, ""},
	} {
		t.Run(name, func(t *testing.T) {
			store := newTerminatingStore(tc.folder)
			require.NoError(t, forceDeleteAs(store, tc.user, tc.options, nil))
			require.Equal(t, tc.wantUpdates, store.updates)
			require.Equal(t, tc.want, store.requester())
		})
	}
}

func TestCascadeDelete_FailedDeleteDoesNotStamp(t *testing.T) {
	for name, f := range map[string]*foldersv1.Folder{"live": finalizerFolder("f"), "terminating": terminatingFolder()} {
		t.Run(name, func(t *testing.T) {
			store := newTerminatingStore(f)
			store.deleteErr = errors.New("boom")
			require.Error(t, forceDeleteAs(store, userA, forceDelete(), nil))
			require.Zero(t, store.updates)
			require.Empty(t, store.requester())
		})
	}
}

func TestCascadeDelete_RejectedValidationDoesNotStamp(t *testing.T) {
	store := newTerminatingStore(finalizerFolder("f"))
	err := forceDeleteAs(store, userA, forceDelete(), func(context.Context, runtime.Object) error { return errors.New("rejected") })
	require.Error(t, err)
	require.Zero(t, store.updates)
}

func TestCascadeDelete_StampFailureIsReturned(t *testing.T) {
	store := newTerminatingStore(finalizerFolder("f"))
	store.updateErr = errors.New("boom")
	require.Error(t, forceDeleteAs(store, userA, forceDelete(), nil))
	// The folder is terminating by then, so a retry stamps it.
	require.NotNil(t, store.existing["f"].DeletionTimestamp)
}

func TestCascadeDelete_StampsFolderAboveVersionCap(t *testing.T) {
	store := newTerminatingStore(finalizerFolder("f"))
	store.rejectLiveUpdates = true
	require.NoError(t, forceDeleteAs(store, userA, forceDelete(), nil))
	require.JSONEq(t, userAValue, store.requester())
}

func TestCascadeDelete_DeletePinsToCheckedVersion(t *testing.T) {
	f := finalizerFolder("f")
	f.ResourceVersion = "1"
	store := newTerminatingStore(f)
	require.NoError(t, forceDeleteAs(store, userA, forceDelete(), nil))
	require.Equal(t, "1", *store.deleteOptions.Preconditions.ResourceVersion)
}

func TestCascadeDelete_SubfolderDeleteByControllerLeavesRequester(t *testing.T) {
	parent, child := finalizerFolder("p"), finalizerFolder("c")
	now := metav1.Now()
	parent.DeletionTimestamp = &now
	child.Annotations = map[string]string{utils.AnnoKeyFolder: "p", annoKeyCascadeDeleteRequester: "keep"}
	store := &fakeFolderStorage{existing: map[string]*foldersv1.Folder{"p": parent, "c": child}}
	var got string
	store.beforeDelete = func() { got = store.existing["c"].Annotations[annoKeyCascadeDeleteRequester] }
	cascade, _ := newDashboardCascade(store, &fakeCascadeSearcher{})
	ctx := identity.WithRequester(ctxWithNamespace(), accessPolicy)
	_, _, err := cascade.Delete(ctx, "c", nil, forceDelete())
	require.NoError(t, err)
	require.Equal(t, "keep", got)
}

func TestCascadeDelete_StampSkippedWhenFolderChangedAfterDelete(t *testing.T) {
	for name, tc := range map[string]struct {
		change func(*terminatingStore)
		want   string
	}{
		"recreated under the same name": {func(s *terminatingStore) {
			replacement := finalizerFolder("f")
			replacement.UID = "new"
			s.existing["f"] = replacement
		}, ""},
		"another request stamped first": {func(s *terminatingStore) {
			s.existing["f"].Annotations = map[string]string{annoKeyCascadeDeleteRequester: "first"}
		}, "first"},
		"already finalized": {func(s *terminatingStore) { delete(s.existing, "f") }, ""},
	} {
		t.Run(name, func(t *testing.T) {
			f := finalizerFolder("f")
			f.UID = "old"
			store := newTerminatingStore(f)
			store.afterDelete = tc.change
			require.NoError(t, forceDeleteAs(store, userA, forceDelete(), nil))
			if got, ok := store.existing["f"]; ok {
				require.Equal(t, tc.want, got.Annotations[annoKeyCascadeDeleteRequester])
			}
		})
	}
}

func TestCascadeDelete_RefusesBeforeDeleteWhenAnnotationsDoNotFit(t *testing.T) {
	f := finalizerFolder("f")
	// Valid on its own, one byte under the limit; only adding the requester overflows it.
	f.Annotations = map[string]string{"big": strings.Repeat("x", validation.TotalAnnotationSizeLimitB-len("big")-1)}
	require.NoError(t, validation.ValidateAnnotationsSize(f.Annotations), "fixture must fit before the requester is added")
	store := newTerminatingStore(f)
	err := forceDeleteAs(store, userA, forceDelete(), nil)
	require.True(t, apierrors.IsBadRequest(err))
	require.Nil(t, store.deleteOptions, "delete must not start")
	require.Nil(t, f.DeletionTimestamp)
}
