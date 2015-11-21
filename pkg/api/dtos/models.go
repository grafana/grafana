package dtos

import (
	"crypto/md5"
	"fmt"
	"strings"
	"time"

	m "github.com/grafana/grafana/pkg/models"
)

type LoginCommand struct {
	User     string `json:"user" binding:"Required"`
	Password string `json:"password" binding:"Required"`
	Remember bool   `json:"remember"`
}

type CurrentUser struct {
	IsSignedIn     bool       `json:"isSignedIn"`
	Id             int64      `json:"id"`
	Login          string     `json:"login"`
	Email          string     `json:"email"`
	Name           string     `json:"name"`
	LightTheme     bool       `json:"lightTheme"`
	OrgId          int64      `json:"orgId"`
	OrgName        string     `json:"orgName"`
	OrgRole        m.RoleType `json:"orgRole"`
	IsGrafanaAdmin bool       `json:"isGrafanaAdmin"`
	GravatarUrl    string     `json:"gravatarUrl"`
}

type DashboardMeta struct {
	IsStarred  bool      `json:"isStarred,omitempty"`
	IsHome     bool      `json:"isHome,omitempty"`
	IsSnapshot bool      `json:"isSnapshot,omitempty"`
	Type       string    `json:"type,omitempty"`
	CanSave    bool      `json:"canSave"`
	CanEdit    bool      `json:"canEdit"`
	CanStar    bool      `json:"canStar"`
	Slug       string    `json:"slug"`
	Expires    time.Time `json:"expires"`
	Created    time.Time `json:"created"`
	Updated    time.Time `json:"updated"`
}

type DashboardFullWithMeta struct {
	Meta      DashboardMeta          `json:"meta"`
	Dashboard map[string]interface{} `json:"dashboard"`
}

type DataSource struct {
	Id                int64                  `json:"id"`
	OrgId             int64                  `json:"orgId"`
	Name              string                 `json:"name"`
	Type              string                 `json:"type"`
	Access            m.DsAccess             `json:"access"`
	Url               string                 `json:"url"`
	Password          string                 `json:"password"`
	User              string                 `json:"user"`
	Database          string                 `json:"database"`
	BasicAuth         bool                   `json:"basicAuth"`
	BasicAuthUser     string                 `json:"basicAuthUser"`
	BasicAuthPassword string                 `json:"basicAuthPassword"`
	IsDefault         bool                   `json:"isDefault"`
	JsonData          map[string]interface{} `json:"jsonData"`
}

type MetricQueryResultDto struct {
	Data []MetricQueryResultDataDto `json:"data"`
}

type MetricQueryResultDataDto struct {
	Target     string       `json:"target"`
	DataPoints [][2]float64 `json:"datapoints"`
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
	return fmt.Sprintf("https://secure.gravatar.com/avatar/%x?s=90&default=mm", hasher.Sum(nil))
}
