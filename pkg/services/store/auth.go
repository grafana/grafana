package store

import (
	"fmt"

	"github.com/grafana/grafana/pkg/services/user"
)

// Really just spitballing here :) this should hook into a system that can give better display info
func GetUserIDString(user *user.SignedInUser) string {
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
