package store

import (
	"fmt"

	"github.com/grafana/grafana/pkg/services/user"
)

// Really just spitballing here :) this should hook into a system that can give better display info
func GetUserIDString(user *user.SignedInUser) string {
	// TODO: should we check IsDisabled?
	// TODO: could we use the NamespacedID.ID() as prefix instead of manually
	// setting "anon", "key", etc.?
	// TODO: the default unauthenticated user is not anonymous and would be
	// returned as `sys:0:` here. We may want to do something special in that
	// case
	if user == nil {
		return ""
	}
	if user.IsAnonymous {
		return "anon"
	}
	if user.ApiKeyID > 0 {
		return fmt.Sprintf("key:%d", user.UserID)
	}
	if user.IsRealUser() {
		return fmt.Sprintf("user:%d:%s", user.UserID, user.Login)
	}
	return fmt.Sprintf("sys:%d:%s", user.UserID, user.Login)
}
