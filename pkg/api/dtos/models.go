package dtos

import (
	"crypto/md5"
	"fmt"
	"regexp"
	"strings"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

var regNonAlphaNumeric = regexp.MustCompile("[^a-zA-Z0-9]+")
var mlog = log.New("models")

type AnyId struct {
	Id int64 `json:"id"`
}

type LoginCommand struct {
	User     string `json:"user" binding:"Required"`
	Password string `json:"password" binding:"Required"`
	Remember bool   `json:"remember"`
}

type CurrentUser struct {
	IsSignedIn                 bool               `json:"isSignedIn"`
	Id                         int64              `json:"id"`
	Login                      string             `json:"login"`
	Email                      string             `json:"email"`
	Name                       string             `json:"name"`
	LightTheme                 bool               `json:"lightTheme"`
	OrgCount                   int                `json:"orgCount"`
	OrgId                      int64              `json:"orgId"`
	OrgName                    string             `json:"orgName"`
	OrgRole                    models.RoleType    `json:"orgRole"`
	IsGrafanaAdmin             bool               `json:"isGrafanaAdmin"`
	GravatarUrl                string             `json:"gravatarUrl"`
	Timezone                   string             `json:"timezone"`
	WeekStart                  string             `json:"weekStart"`
	Locale                     string             `json:"locale"`
	HelpFlags1                 models.HelpFlags1  `json:"helpFlags1"`
	HasEditPermissionInFolders bool               `json:"hasEditPermissionInFolders"`
	Permissions                UserPermissionsMap `json:"permissions,omitempty"`
}

type UserPermissionsMap map[string]bool

type MetricRequest struct {
	From    string             `json:"from"`
	To      string             `json:"to"`
	Queries []*simplejson.Json `json:"queries"`
	Debug   bool               `json:"debug"`
}

func GetGravatarUrl(text string) string {
	if setting.DisableGravatar {
		return setting.AppSubUrl + "/public/img/user_profile.png"
	}

	if text == "" {
		return ""
	}

	hasher := md5.New()
	if _, err := hasher.Write([]byte(strings.ToLower(text))); err != nil {
		mlog.Warn("Failed to hash text", "err", err)
	}
	return fmt.Sprintf(setting.AppSubUrl+"/avatar/%x", hasher.Sum(nil))
}

func GetGravatarUrlWithDefault(text string, defaultText string) string {
	if text != "" {
		return GetGravatarUrl(text)
	}

	text = regNonAlphaNumeric.ReplaceAllString(defaultText, "") + "@localhost"

	return GetGravatarUrl(text)
}

func IsHiddenUser(userLogin string, signedInUser *models.SignedInUser, cfg *setting.Cfg) bool {
	if userLogin == "" || signedInUser.IsGrafanaAdmin || userLogin == signedInUser.Login {
		return false
	}

	if _, hidden := cfg.HiddenUsers[userLogin]; hidden {
		return true
	}

	return false
}
