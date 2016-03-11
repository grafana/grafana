package models

import (
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
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
	SecureJsonData SecureJsonData

	Created time.Time
	Updated time.Time
}

type SecureJsonData map[string][]byte

func (s SecureJsonData) Decrypt() map[string]string {
	decrypted := make(map[string]string)
	for key, data := range s {
		decrypted[key] = string(util.Decrypt(data, setting.SecretKey))
	}
	return decrypted
}

// ----------------------
// COMMANDS

// Also acts as api DTO
type UpdatePluginSettingCmd struct {
	Enabled        bool                   `json:"enabled"`
	Pinned         bool                   `json:"pinned"`
	JsonData       map[string]interface{} `json:"jsonData"`
	SecureJsonData map[string]string      `json:"secureJsonData"`

	PluginId string `json:"-"`
	OrgId    int64  `json:"-"`
}

func (cmd *UpdatePluginSettingCmd) GetEncryptedJsonData() SecureJsonData {
	encrypted := make(SecureJsonData)
	for key, data := range cmd.SecureJsonData {
		encrypted[key] = util.Encrypt([]byte(data), setting.SecretKey)
	}
	return encrypted
}

// ---------------------
// QUERIES
type GetPluginSettingsQuery struct {
	OrgId  int64
	Result []*PluginSettingInfoDTO
}

type PluginSettingInfoDTO struct {
	OrgId    int64
	PluginId string
	Enabled  bool
	Pinned   bool
}

type GetPluginSettingByIdQuery struct {
	PluginId string
	OrgId    int64
	Result   *PluginSetting
}
