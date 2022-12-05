package store

import (
	"encoding/json"

	"github.com/grafana/grafana/pkg/services/user"
)

type UserInfo struct {
	UserID   int64
	OrgID    int64
	Login    string
	UserType string
}

func UserInfoFromString(raw string) *UserInfo {
	var userInfo UserInfo

	if err := json.Unmarshal([]byte(raw), &userInfo); err != nil {
		return nil
	}

	return &userInfo
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
