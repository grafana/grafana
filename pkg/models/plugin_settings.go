package models

import (
	"errors"
	"time"
)

var (
	ErrPluginSettingNotFound = errors.New("plugin setting not found")
)

type PluginSetting struct {
	Id             int64
	PluginId       string
	OrgId          int64
	Enabled        bool
	Pinned         bool
	JsonData       map[string]interface{}
	SecureJsonData map[string][]byte
	PluginVersion  string

	Created time.Time
	Updated time.Time
}

type PluginSettingInfo struct {
	PluginID      string `xorm:"plugin_id"`
	OrgID         int64  `xorm:"org_id"`
	Enabled       bool   `xorm:"enabled"`
	Pinned        bool   `xorm:"pinned"`
	PluginVersion string `xorm:"plugin_id"`
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

	PluginId                string            `json:"-"`
	OrgId                   int64             `json:"-"`
	EncryptedSecureJsonData map[string][]byte `json:"-"`
}

// specific command, will only update version
type UpdatePluginSettingVersionCmd struct {
	PluginVersion string
	PluginId      string `json:"-"`
	OrgId         int64  `json:"-"`
}

// ---------------------
// QUERIES

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
