package folder

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func TestIsUncheckedDeleteAuthorized(t *testing.T) {
	user := &identity.StaticRequester{UserUID: "real-user"}
	otherUser := &identity.StaticRequester{UserUID: "other-user"}
	folderUIDs := []string{"fold1", "fold2"}

	assert.False(t, IsUncheckedDeleteAuthorized(context.Background(), 1, user, folderUIDs), "an unmarked ctx must never be authorized")

	ctx := WithUncheckedDeleteAuthorized(context.Background(), 1, user, folderUIDs, true)
	assert.True(t, IsUncheckedDeleteAuthorized(ctx, 1, user, folderUIDs), "the exact org/user/folders it was marked for must be authorized")
	assert.True(t, IsUncheckedDeleteAuthorized(ctx, 1, user, []string{"fold2", "fold1"}), "folder order must not matter")
	assert.True(t, IsUncheckedDeleteAuthorized(ctx, 1, user, []string{"fold1"}), "a subset of the authorized batch must be authorized too, since a checked caller may delegate per-folder")
	assert.False(t, IsUncheckedDeleteAuthorized(ctx, 2, user, folderUIDs), "a different org must not inherit the marker")
	assert.False(t, IsUncheckedDeleteAuthorized(ctx, 1, otherUser, folderUIDs), "a different requester must not inherit the marker")
	assert.False(t, IsUncheckedDeleteAuthorized(ctx, 1, user, []string{"fold3"}), "a ctx marked for one folder set must not authorize a delete of a different one")
	assert.False(t, IsUncheckedDeleteAuthorized(ctx, 1, user, []string{"fold1", "fold3"}), "a batch that includes even one unauthorized folder must not be authorized")
}

func TestWithUncheckedDeleteAuthorized_notChecked(t *testing.T) {
	user := &identity.StaticRequester{UserUID: "real-user"}

	ctx := WithUncheckedDeleteAuthorized(context.Background(), 1, user, []string{"fold1"}, false)
	assert.False(t, IsUncheckedDeleteAuthorized(ctx, 1, user, []string{"fold1"}), "checked=false must leave ctx unmarked even for a valid user")
}

func TestWithUncheckedDeleteAuthorized_invalidatesStaleMarker(t *testing.T) {
	user := &identity.StaticRequester{UserUID: "real-user"}
	folderUIDs := []string{"fold1"}

	ctx := WithUncheckedDeleteAuthorized(context.Background(), 1, user, folderUIDs, true)
	require.True(t, IsUncheckedDeleteAuthorized(ctx, 1, user, folderUIDs), "sanity check: ctx is authorized before the re-check")

	// A later re-check for the same org/user/folders fails -- the earlier grant must not survive.
	ctx = WithUncheckedDeleteAuthorized(ctx, 1, user, folderUIDs, false)
	assert.False(t, IsUncheckedDeleteAuthorized(ctx, 1, user, folderUIDs), "a failed re-check must invalidate a prior marker, not leave it in place")
}

func TestIsUncheckedDeleteAuthorized_crossStackUIDCollision(t *testing.T) {
	// stacks-<id> namespaces all collapse to legacy OrgID 1, and a UID is only unique within its own stack.
	stack11User := &identity.StaticRequester{UserUID: "user-5", Namespace: "stacks-11"}
	stack22User := &identity.StaticRequester{UserUID: "user-5", Namespace: "stacks-22"}
	folderUIDs := []string{"fold1"}

	ctx := WithUncheckedDeleteAuthorized(context.Background(), 1, stack11User, folderUIDs, true)
	assert.True(t, IsUncheckedDeleteAuthorized(ctx, 1, stack11User, folderUIDs), "the exact stack/user it was marked for must be authorized")
	assert.False(t, IsUncheckedDeleteAuthorized(ctx, 1, stack22User, folderUIDs),
		"a same-UID requester from a different stack must not inherit the marker, even though both stacks collapse to orgID 1")
}

func TestIsUncheckedDeleteAuthorized_nilUser(t *testing.T) {
	var nilRequester *identity.StaticRequester

	assert.NotPanics(t, func() {
		ctx := WithUncheckedDeleteAuthorized(context.Background(), 1, nilRequester, []string{"fold1"}, true)
		assert.False(t, IsUncheckedDeleteAuthorized(ctx, 1, nilRequester, []string{"fold1"}), "a nil requester must never be treated as authorized")
	})
}
