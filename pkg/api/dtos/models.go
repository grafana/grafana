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

type AnyId struct {
	Id int64 `json:"id"`
}

type LoginCommand struct {
	User     string `json:"user" binding:"Required"`
	Password string `json:"password" binding:"Required"`
	Remember bool   `json:"remember"`
}

type CurrentUser struct {
	IsSignedIn                 bool              `json:"isSignedIn"`
	Id                         int64             `json:"id"`
	Login                      string            `json:"login"`
	Email                      string            `json:"email"`
	Name                       string            `json:"name"`
	LightTheme                 bool              `json:"lightTheme"`
	OrgCount                   int               `json:"orgCount"`
	OrgId                      int64             `json:"orgId"`
	OrgName                    string            `json:"orgName"`
	OrgRole                    models.RoleType   `json:"orgRole"`
	IsGrafanaAdmin             bool              `json:"isGrafanaAdmin"`
	GravatarUrl                string            `json:"gravatarUrl"`
	Timezone                   string            `json:"timezone"`
	Locale                     string            `json:"locale"`
	HelpFlags1                 models.HelpFlags1 `json:"helpFlags1"`
	HasEditPermissionInFolders bool              `json:"hasEditPermissionInFolders"`
}

type MetricRequest struct {
	From    string             `json:"from"`
	To      string             `json:"to"`
	Queries []*simplejson.Json `json:"queries"`
	Debug   bool               `json:"debug"`
}

type UserStars struct {
	DashboardIds map[string]bool `json:"dashboardIds"`
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
		log.Warn("Failed to hash text: %s", err)
	}
	return fmt.Sprintf(setting.AppSubUrl+"/avatar/%x", hasher.Sum(nil))
}

func GetGravatarUrlWithDefault(text string, defaultText string) string {
	if text != "" {
		return GetGravatarUrl(text)
	}

	reg, err := regexp.Compile("[^a-zA-Z0-9]+")

	if err != nil {
		return ""
	}

	text = reg.ReplaceAllString(defaultText, "") + "@localhost"

	return GetGravatarUrl(text)
}
