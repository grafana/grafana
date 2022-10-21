package store

import (
	"context"
	"fmt"
	"strconv"
	"strings"

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
	var orgID, userID int64
	login := ""

	split := strings.Split(raw, ":")
	if len(split) < 3 {
		return nil
	}

	if i, err := strconv.ParseInt(split[1], 10, 64); err == nil {
		orgID = i
	}

	if i, err := strconv.ParseInt(split[2], 10, 64); err == nil {
		userID = i
	}

	if len(split) > 3 {
		login = split[3]
	}

	return &UserInfo{
		UserID:   userID,
		OrgID:    orgID,
		Login:    login,
		UserType: split[0],
	}
}

func (u *UserInfo) String() string {
	return fmt.Sprintf("%s:%d:%d:%s", u.UserType, u.OrgID, u.UserID, u.Login)
}
