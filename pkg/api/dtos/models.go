package dtos

import (
	"crypto/md5"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
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
	IsSignedIn     bool         `json:"isSignedIn"`
	Id             int64        `json:"id"`
	Login          string       `json:"login"`
	Email          string       `json:"email"`
	Name           string       `json:"name"`
	LightTheme     bool         `json:"lightTheme"`
	OrgId          int64        `json:"orgId"`
	OrgName        string       `json:"orgName"`
	OrgRole        m.RoleType   `json:"orgRole"`
	IsGrafanaAdmin bool         `json:"isGrafanaAdmin"`
	GravatarUrl    string       `json:"gravatarUrl"`
	Timezone       string       `json:"timezone"`
	Locale         string       `json:"locale"`
	HelpFlags1     m.HelpFlags1 `json:"helpFlags1"`
}

type DataSource struct {
	Id                int64            `json:"id"`
	OrgId             int64            `json:"orgId"`
	Name              string           `json:"name"`
	Type              string           `json:"type"`
	TypeLogoUrl       string           `json:"typeLogoUrl"`
	Access            m.DsAccess       `json:"access"`
	Url               string           `json:"url"`
	Password          string           `json:"password"`
	User              string           `json:"user"`
	Database          string           `json:"database"`
	BasicAuth         bool             `json:"basicAuth"`
	BasicAuthUser     string           `json:"basicAuthUser"`
	BasicAuthPassword string           `json:"basicAuthPassword"`
	WithCredentials   bool             `json:"withCredentials"`
	IsDefault         bool             `json:"isDefault"`
	JsonData          *simplejson.Json `json:"jsonData,omitempty"`
	SecureJsonFields  map[string]bool  `json:"secureJsonFields"`
}

type DataSourceListItemDTO struct {
	Id          int64            `json:"id"`
	OrgId       int64            `json:"orgId"`
	Name        string           `json:"name"`
	Type        string           `json:"type"`
	TypeLogoUrl string           `json:"typeLogoUrl"`
	Access      m.DsAccess       `json:"access"`
	Url         string           `json:"url"`
	Password    string           `json:"password"`
	User        string           `json:"user"`
	Database    string           `json:"database"`
	BasicAuth   bool             `json:"basicAuth"`
	IsDefault   bool             `json:"isDefault"`
	JsonData    *simplejson.Json `json:"jsonData,omitempty"`
}

type DataSourceList []DataSourceListItemDTO

func (slice DataSourceList) Len() int {
	return len(slice)
}

func (slice DataSourceList) Less(i, j int) bool {
	return strings.ToLower(slice[i].Name) < strings.ToLower(slice[j].Name)
}

func (slice DataSourceList) Swap(i, j int) {
	slice[i], slice[j] = slice[j], slice[i]
}

type MetricRequest struct {
	From    string             `json:"from"`
	To      string             `json:"to"`
	Queries []*simplejson.Json `json:"queries"`
}

type UserStars struct {
	DashboardIds map[string]bool `json:"dashboardIds"`
}

func GetGravatarUrl(text string) string {
	if text == "" {
		return ""
	}

	hasher := md5.New()
	hasher.Write([]byte(strings.ToLower(text)))
	return fmt.Sprintf(setting.AppSubUrl+"/avatar/%x", hasher.Sum(nil))
}
