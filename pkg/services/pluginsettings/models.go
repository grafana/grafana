package pluginsettings

import (
	"time"
)

type DTO struct {
	ID             int64
	OrgID          int64
	PluginID       string
	PluginVersion  string
	JSONData       map[string]interface{}
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
}

type UpdateArgs struct {
	Enabled                 bool
	Pinned                  bool
	JSONData                map[string]interface{}
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
