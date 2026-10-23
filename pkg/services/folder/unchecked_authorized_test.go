package folder

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func TestIsUncheckedDeleteAuthorized(t *testing.T) {
	user := &identity.StaticRequester{UserUID: "real-user"}
	otherUser := &identity.StaticRequester{UserUID: "other-user"}

	assert.False(t, IsUncheckedDeleteAuthorized(context.Background(), 1, user), "an unmarked ctx must never be authorized")

	ctx := WithUncheckedDeleteAuthorized(context.Background(), 1, user, true)
	assert.True(t, IsUncheckedDeleteAuthorized(ctx, 1, user), "the exact org/user it was marked for must be authorized")
	assert.False(t, IsUncheckedDeleteAuthorized(ctx, 2, user), "a different org must not inherit the marker")
	assert.False(t, IsUncheckedDeleteAuthorized(ctx, 1, otherUser), "a different requester must not inherit the marker")
}

func TestWithUncheckedDeleteAuthorized_notChecked(t *testing.T) {
	user := &identity.StaticRequester{UserUID: "real-user"}

	ctx := WithUncheckedDeleteAuthorized(context.Background(), 1, user, false)
	assert.False(t, IsUncheckedDeleteAuthorized(ctx, 1, user), "checked=false must leave ctx unmarked even for a valid user")
}

func TestIsUncheckedDeleteAuthorized_crossStackUIDCollision(t *testing.T) {
	// stacks-<id> namespaces all collapse to legacy OrgID 1, and a UID is only unique within its own stack.
	stack11User := &identity.StaticRequester{UserUID: "user-5", Namespace: "stacks-11"}
	stack22User := &identity.StaticRequester{UserUID: "user-5", Namespace: "stacks-22"}

	ctx := WithUncheckedDeleteAuthorized(context.Background(), 1, stack11User, true)
	assert.True(t, IsUncheckedDeleteAuthorized(ctx, 1, stack11User), "the exact stack/user it was marked for must be authorized")
	assert.False(t, IsUncheckedDeleteAuthorized(ctx, 1, stack22User),
		"a same-UID requester from a different stack must not inherit the marker, even though both stacks collapse to orgID 1")
}

func TestIsUncheckedDeleteAuthorized_nilUser(t *testing.T) {
	var nilRequester *identity.StaticRequester

	assert.NotPanics(t, func() {
		ctx := WithUncheckedDeleteAuthorized(context.Background(), 1, nilRequester, true)
		assert.False(t, IsUncheckedDeleteAuthorized(ctx, 1, nilRequester), "a nil requester must never be treated as authorized")
	})
}
