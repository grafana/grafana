package store

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	grpccontext "github.com/grafana/grafana/pkg/services/grpcserver/context"
	"github.com/grafana/grafana/pkg/services/user"
)

type ctxUserKey struct{}

func ContextWithUser(ctx context.Context, data *user.SignedInUser) context.Context {
	return context.WithValue(ctx, ctxUserKey{}, data)
}

// UserFromContext ** Experimental **
func UserFromContext(ctx context.Context) *user.SignedInUser {
	grpcCtx := grpccontext.FromContext(ctx)
	if grpcCtx != nil {
		return grpcCtx.SignedInUser
	}

	// Explicitly set in context
	u, ok := ctx.Value(ctxUserKey{}).(*user.SignedInUser)
	if ok && u != nil {
		return u
	}

	// From the HTTP request
	c, ok := ctxkey.Get(ctx).(*models.ReqContext)
	if !ok || c == nil || c.SignedInUser == nil {
		return nil
	}

	return c.SignedInUser
}

func GetUserIDString(user *user.SignedInUser) string {
	if user == nil {
		return ""
	}
	userType := "user"
	if !user.IsRealUser() {
		userType = "sys"
	}
	userInfo := UserInfo{
		UserID:   user.UserID,
		OrgID:    user.OrgID,
		Login:    user.Login,
		UserType: userType,
	}
	return userInfo.String()
}

type UserInfo struct {
	UserID   int64
	OrgID    int64
	Login    string
	UserType string
}

func UserInfoFromString(raw string) *UserInfo {
	var userType, login string
	var orgID, userID int64
	_, err := fmt.Sscanf(raw, "%s:%d:%d:%s", &userType, &orgID, &userID, &login)
	if err != nil {
		return nil
	}
	return &UserInfo{
		UserID:   userID,
		OrgID:    orgID,
		Login:    login,
		UserType: userType,
	}
}

func (u *UserInfo) String() string {
	return fmt.Sprintf("%s:%d:%d:%s", u.UserType, u.OrgID, u.UserID, u.Login)
}
