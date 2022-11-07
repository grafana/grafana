package dtos

import (
	"strings"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/datasources"
)

type DataSource struct {
	Id               int64                  `json:"id"`
	UID              string                 `json:"uid"`
	OrgId            int64                  `json:"orgId"`
	Name             string                 `json:"name"`
	Type             string                 `json:"type"`
	TypeLogoUrl      string                 `json:"typeLogoUrl"`
	Access           datasources.DsAccess   `json:"access"`
	Url              string                 `json:"url"`
	User             string                 `json:"user"`
	Database         string                 `json:"database"`
	BasicAuth        bool                   `json:"basicAuth"`
	BasicAuthUser    string                 `json:"basicAuthUser"`
	WithCredentials  bool                   `json:"withCredentials"`
	IsDefault        bool                   `json:"isDefault"`
	JsonData         *simplejson.Json       `json:"jsonData,omitempty"`
	SecureJsonFields map[string]bool        `json:"secureJsonFields"`
	Version          int                    `json:"version"`
	ReadOnly         bool                   `json:"readOnly"`
	AccessControl    accesscontrol.Metadata `json:"accessControl,omitempty"`
}

type DataSourceListItemDTO struct {
	Id          int64                `json:"id"`
	UID         string               `json:"uid"`
	OrgId       int64                `json:"orgId"`
	Name        string               `json:"name"`
	Type        string               `json:"type"`
	TypeName    string               `json:"typeName"`
	TypeLogoUrl string               `json:"typeLogoUrl"`
	Access      datasources.DsAccess `json:"access"`
	Url         string               `json:"url"`
	User        string               `json:"user"`
	Database    string               `json:"database"`
	BasicAuth   bool                 `json:"basicAuth"`
	IsDefault   bool                 `json:"isDefault"`
	JsonData    *simplejson.Json     `json:"jsonData,omitempty"`
	ReadOnly    bool                 `json:"readOnly"`
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
