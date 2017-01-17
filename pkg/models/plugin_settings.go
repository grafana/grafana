package models

import (
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/components/securejsondata"
)

var (
	ErrPluginSettingNotFound = errors.New("Plugin setting not found")
)

type PluginSetting struct {
	Id             int64
	PluginId       string
	OrgId          int64
	Enabled        bool
	Pinned         bool
	JsonData       map[string]interface{}
	SecureJsonData securejsondata.SecureJsonData
	PluginVersion  string

	Created time.Time
	Updated time.Time
}

// ----------------------
// COMMANDS

// Also acts as api DTO
type UpdatePluginSettingCmd struct {
	Enabled        bool                   `json:"enabled"`
	Pinned         bool                   `json:"pinned"`
	JsonData       map[string]interface{} `json:"jsonData"`
	SecureJsonData map[string]string      `json:"secureJsonData"`
	PluginVersion  string                 `json:"version"`

	PluginId string `json:"-"`
	OrgId    int64  `json:"-"`
}

// specific command, will only update version
type UpdatePluginSettingVersionCmd struct {
	PluginVersion string
	PluginId      string `json:"-"`
	OrgId         int64  `json:"-"`
}

func (cmd *UpdatePluginSettingCmd) GetEncryptedJsonData() securejsondata.SecureJsonData {
	return securejsondata.GetEncryptedJsonData(cmd.SecureJsonData)
}

// ---------------------
// QUERIES
type GetPluginSettingsQuery struct {
	OrgId  int64
	Result []*PluginSettingInfoDTO
}

type PluginSettingInfoDTO struct {
	OrgId         int64
	PluginId      string
	Enabled       bool
	Pinned        bool
	PluginVersion string
}

type GetPluginSettingByIdQuery struct {
	PluginId string
	OrgId    int64
	Result   *PluginSetting
}

type PluginStateChangedEvent struct {
	PluginId string
	OrgId    int64
	Enabled  bool
}
