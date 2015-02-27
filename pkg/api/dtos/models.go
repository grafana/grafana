package dtos

import (
	"crypto/md5"
	"fmt"
	"strings"

	m "github.com/grafana/grafana/pkg/models"
)

type LoginCommand struct {
	User     string `json:"user" binding:"Required"`
	Password string `json:"password" binding:"Required"`
	Remember bool   `json:"remember"`
}

type CurrentUser struct {
	IsSignedIn     bool       `json:"isSignedIn"`
	Login          string     `json:"login"`
	Email          string     `json:"email"`
	Name           string     `json:"name"`
	OrgRole        m.RoleType `json:"orgRole"`
	OrgName        string     `json:"orgName"`
	IsGrafanaAdmin bool       `json:"isGrafanaAdmin"`
	GravatarUrl    string     `json:"gravatarUrl"`
}

type DashboardMeta struct {
	IsStarred bool   `json:"isStarred"`
	IsHome    bool   `json:"isHome"`
	Slug      string `json:"slug"`
}

type Dashboard struct {
	Meta  DashboardMeta          `json:"meta"`
	Model map[string]interface{} `json:"model"`
}

type DataSource struct {
	Id        int64      `json:"id"`
	OrgId     int64      `json:"orgId"`
	Name      string     `json:"name"`
	Type      string     `json:"type"`
	Access    m.DsAccess `json:"access"`
	Url       string     `json:"url"`
	Password  string     `json:"password"`
	User      string     `json:"user"`
	Database  string     `json:"database"`
	BasicAuth bool       `json:"basicAuth"`
	IsDefault bool       `json:"isDefault"`
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
