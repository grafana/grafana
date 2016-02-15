package models

import (
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var (
	ErrAppSettingNotFound = errors.New("AppSetting not found")
)

type AppSettings struct {
	Id             int64
	AppId          string
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
type UpdateAppSettingsCmd struct {
	Enabled        bool                   `json:"enabled"`
	Pinned         bool                   `json:"pinned"`
	JsonData       map[string]interface{} `json:"jsonData"`
	SecureJsonData map[string]string      `json:"secureJsonData"`

	AppId string `json:"-"`
	OrgId int64  `json:"-"`
}

func (cmd *UpdateAppSettingsCmd) GetEncryptedJsonData() SecureJsonData {
	encrypted := make(SecureJsonData)
	for key, data := range cmd.SecureJsonData {
		encrypted[key] = util.Encrypt([]byte(data), setting.SecretKey)
	}
	return encrypted
}

// ---------------------
// QUERIES
type GetAppSettingsQuery struct {
	OrgId  int64
	Result []*AppSettings
}

type GetAppSettingByAppIdQuery struct {
	AppId  string
	OrgId  int64
	Result *AppSettings
}
