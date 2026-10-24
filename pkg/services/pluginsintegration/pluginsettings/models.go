package pluginsettings

import (
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
)

var (
	ErrPluginSettingNotFound     = errors.New("plugin setting not found")
	ErrPluginSettingDataTooLarge = errutil.ValidationFailed("pluginsettings.dataTooLarge", errutil.WithPublicMessage("Plugin settings data is too large to store."))
	errDataTooLargeTemplate      = ErrPluginSettingDataTooLarge.MustTemplate(
		"plugin {{ .Private.field }} is {{ .Private.size }} bytes, the limit is {{ .Private.limit }} bytes",
		errutil.WithPublic("Plugin {{ .Public.field }} is too large to store."),
	)
)

// NewDataTooLargeError builds an ErrPluginSettingDataTooLarge that names the oversized field.
func NewDataTooLargeError(field string, size, limit int) error {
	return errDataTooLargeTemplate.Build(errutil.TemplateData{
		Private: map[string]any{"field": field, "size": size, "limit": limit},
		Public:  map[string]any{"field": field},
	})
}

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
