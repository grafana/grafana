package resource

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func trashTestKey() *resourcepb.ResourceKey {
	return &resourcepb.ResourceKey{
		Namespace: "default",
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
	}
}

func trashTestUser(uid string) authlib.AuthInfo {
	return &identity.StaticRequester{Type: authlib.TypeUser, UserUID: uid, Namespace: "default"}
}

// recordedCheck lets tests assert on the verb and scope, not just the answer.
type recordedCheck struct {
	verb   string
	folder string
}

func newRecordingAuthorizer(
	t *testing.T,
	uid string,
	allow func(folder string) bool,
	err error,
) (*TrashAuthorizer, *[]recordedCheck, *[]error) {
	t.Helper()
	var calls []recordedCheck
	var reported []error
	ac := &callbackAccessClient{fn: func(req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
		calls = append(calls, recordedCheck{verb: req.Verb, folder: folder})
		if err != nil {
			return authlib.CheckResponse{}, err
		}
		return authlib.CheckResponse{Allowed: allow(folder), Zookie: authlib.NoopZookie{}}, nil
	}}
	a := NewTrashAuthorizer(ac, trashTestUser(uid), trashTestKey(), func(e error) {
		reported = append(reported, e)
	})
	return a, &calls, &reported
}

// Recognising the deleter is what keeps trash cheap, so it must cost no call.
func TestTrashAuthorizer_DeleterIsAllowedWithoutAnyCheck(t *testing.T) {
	a, calls, _ := newRecordingAuthorizer(t, "alice", func(string) bool { return false }, nil)

	assert.True(t, a.Allowed(t.Context(), "folder-1", "user:alice"))
	assert.Empty(t, *calls, "recognising the deleter must not call the access client")
}

func TestTrashAuthorizer_FolderAdminIsAllowed(t *testing.T) {
	a, calls, _ := newRecordingAuthorizer(t, "carol", func(folder string) bool { return folder == "folder-1" }, nil)

	assert.True(t, a.Allowed(t.Context(), "folder-1", "user:alice"))
	assert.False(t, a.Allowed(t.Context(), "folder-2", "user:alice"))

	require.Len(t, *calls, 2)
	for _, c := range *calls {
		assert.Equal(t, utils.VerbSetPermissions, c.verb, "folder admin is a set_permissions check")
	}
}

// Read access to the folder must not be enough, which is the disclosure this rule
// exists to prevent.
func TestTrashAuthorizer_OtherUsersDeletionIsDenied(t *testing.T) {
	a, _, _ := newRecordingAuthorizer(t, "bob", func(string) bool { return false }, nil)

	assert.False(t, a.Allowed(t.Context(), "folder-1", "user:alice"))
}

// The same UID may belong to a different person in another namespace.
func TestTrashAuthorizer_DeleterFromAnotherNamespaceIsDenied(t *testing.T) {
	var calls []recordedCheck
	ac := &callbackAccessClient{fn: func(req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
		calls = append(calls, recordedCheck{verb: req.Verb, folder: folder})
		return authlib.CheckResponse{}, authlib.ErrNamespaceMismatch
	}}
	stranger := &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "alice", Namespace: "other-namespace"}
	a := NewTrashAuthorizer(ac, stranger, trashTestKey(), func(error) {})

	require.Equal(t, "user:alice", stranger.GetUID(), "same UID, another namespace")
	assert.False(t, a.Allowed(t.Context(), "folder-1", "user:alice"))
	assert.Len(t, calls, 1, "it falls through to the folder check rather than short-circuiting")
}

// A wildcard identity is scoped to every namespace, so it still matches.
func TestTrashAuthorizer_WildcardNamespaceMatches(t *testing.T) {
	ac := &callbackAccessClient{fn: func(authlib.CheckRequest, string) (authlib.CheckResponse, error) {
		return authlib.CheckResponse{Allowed: false, Zookie: authlib.NoopZookie{}}, nil
	}}
	wildcard := &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "alice", Namespace: "*"}
	a := NewTrashAuthorizer(ac, wildcard, trashTestKey(), func(error) {})

	assert.True(t, a.Allowed(t.Context(), "folder-1", "user:alice"))
}

// Otherwise a missing deleter would match a caller with an empty UID.
func TestTrashAuthorizer_EmptyDeletedByNeverMatches(t *testing.T) {
	a, calls, _ := newRecordingAuthorizer(t, "", func(string) bool { return false }, nil)

	assert.False(t, a.Allowed(t.Context(), "folder-1", ""))
	assert.Len(t, *calls, 1, "it must fall through to the folder check, not short-circuit")
}

func TestTrashAuthorizer_CachesOneCheckPerFolder(t *testing.T) {
	a, calls, _ := newRecordingAuthorizer(t, "carol", func(string) bool { return true }, nil)

	for range 5 {
		assert.True(t, a.Allowed(t.Context(), "folder-1", "user:alice"))
	}
	assert.True(t, a.Allowed(t.Context(), "folder-2", "user:alice"))

	assert.Equal(t, []recordedCheck{
		{verb: utils.VerbSetPermissions, folder: "folder-1"},
		{verb: utils.VerbSetPermissions, folder: "folder-2"},
	}, *calls)
}

// Denials need caching too, or a folder the caller does not administer costs a call
// per object.
func TestTrashAuthorizer_CachesDenials(t *testing.T) {
	a, calls, _ := newRecordingAuthorizer(t, "bob", func(string) bool { return false }, nil)

	for range 5 {
		assert.False(t, a.Allowed(t.Context(), "folder-1", "user:alice"))
	}
	assert.Len(t, *calls, 1)
}

// The failure is swallowed, so without a report an authz outage would silently
// empty everyone's trash.
func TestTrashAuthorizer_ReportsCheckFailuresAndDenies(t *testing.T) {
	boom := errors.New("authz unavailable")
	a, _, reported := newRecordingAuthorizer(t, "carol", nil, boom)

	assert.False(t, a.Allowed(t.Context(), "folder-1", "user:alice"))

	require.Len(t, *reported, 1)
	assert.ErrorIs(t, (*reported)[0], boom)
}

// Kinds outside the folder tree carry no folder, making the check namespace-wide.
func TestTrashAuthorizer_FolderlessKindChecksTheWholeNamespace(t *testing.T) {
	a, calls, _ := newRecordingAuthorizer(t, "carol", func(folder string) bool {
		return folder == "" // granted namespace-wide
	}, nil)

	assert.True(t, a.Allowed(t.Context(), "", "user:alice"))

	require.Len(t, *calls, 1)
	assert.Equal(t, utils.VerbSetPermissions, (*calls)[0].verb)
	assert.Empty(t, (*calls)[0].folder, "no folder means the check is not scoped to one")
}
