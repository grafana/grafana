package authtoken

type IdentityType string

const (
	IdentityTypeUser   = "user"
	IdentityTypePlugin = "plugin"
)

type UserIdentity struct {
	OrgID  int64 `json:"orgId"`
	UserID int64 `json:"userId"`
}

type PluginIdentity struct {
	OrgID    int64  `json:"orgId"`
	PluginID string `json:"pluginId"`
}

// Identity is an information about request issuer.
type Identity struct {
	Type           IdentityType    `json:"identity"`
	UserIdentity   *UserIdentity   `json:"user,omitempty"`
	PluginIdentity *PluginIdentity `json:"plugin,omitempty"`
}
