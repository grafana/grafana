package dtos

import (
	"crypto/md5"
	"fmt"
	"strings"

	m "github.com/torkelo/grafana-pro/pkg/models"
)

type LoginCommand struct {
	User     string `json:"user" binding:"Required"`
	Password string `json:"password" binding:"Required"`
	Remember bool   `json:"remember"`
}

type CurrentUser struct {
	Login            string     `json:"login"`
	Email            string     `json:"email"`
	Role             m.RoleType `json:"role"`
	Name             string     `json:"name"`
	UsingAccountName string     `json:"usingAccountName"`
	IsGrafanaAdmin   bool       `json:"isGrafanaAdmin"`
	GravatarUrl      string     `json:"gravatarUrl"`
}

type DataSource struct {
	Id        int64      `json:"id"`
	AccountId int64      `json:"accountId"`
	Name      string     `json:"name"`
	Type      m.DsType   `json:"type"`
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

func GetGravatarUrl(text string) string {
	if text == "" {
		return ""
	}

	hasher := md5.New()
	hasher.Write([]byte(strings.ToLower(text)))
	return fmt.Sprintf("https://secure.gravatar.com/avatar/%x?s=90&default=mm", hasher.Sum(nil))
}
