package pluginsettings

import (
	"errors"
	"time"
)

var (
	ErrPluginSettingNotFound = errors.New("plugin setting not found")
)

type DTO struct {
	ID             int64
	OrgID          int64
	PluginID       string
	PluginVersion  string
	JSONData       map[string]any
	SecureJSONData map[string][]byte
	Enabled        bool
	Pinned         bool
	Updated        time.Time
}

type InfoDTO struct {
	PluginID      string
	OrgID         int64
	Enabled       bool
	Pinned        bool
	PluginVersion string
	AutoEnabled   bool
}

type UpdateArgs struct {
	Enabled                 bool
	Pinned                  bool
	JSONData                map[string]any
	SecureJSONData          map[string]string
	PluginVersion           string
	PluginID                string
	OrgID                   int64
	EncryptedSecureJSONData map[string][]byte
}

type UpdatePluginVersionArgs struct {
	PluginVersion string
	PluginID      string
	OrgID         int64
}

type GetArgs struct {
	OrgID int64
}

type GetByPluginIDArgs struct {
	PluginID string
	OrgID    int64
}

type PluginSetting struct {
	Id             int64
	PluginId       string
	OrgId          int64
	Enabled        bool
	Pinned         bool
	JsonData       map[string]any
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
	PluginVersion string `xorm:"plugin_version"`
}

// ----------------------
// COMMANDS

// Also acts as api DTO
type UpdatePluginSettingCmd struct {
	Enabled        bool              `json:"enabled"`
	Pinned         bool              `json:"pinned"`
	JsonData       map[string]any    `json:"jsonData"`
	SecureJsonData map[string]string `json:"secureJsonData"`
	PluginVersion  string            `json:"version"`

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
