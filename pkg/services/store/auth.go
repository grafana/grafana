package store

import (
	"encoding/json"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/services/user"
)

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
	raw, err := json.Marshal(u)
	if err != nil {
		return ""
	}
	return string(raw)
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
