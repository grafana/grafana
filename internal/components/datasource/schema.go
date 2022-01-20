package datasource

import (
	"embed"

	"github.com/grafana/grafana/pkg/schema"
	"github.com/grafana/thema"
)

var sch *schema.ThemaSchema

func RegisterDatasourceSchema(lib thema.Library, reg *schema.CoreRegistry) {
	reg.Store("datasource", sch)
	return
}

//go:embed datasource.cue
var cueFS embed.FS

func DatasourceLineage(lib thema.Library, o ...thema.BindOption) (thema.Lineage, error) {
	panic("TODO")
}

var _ thema.LineageFactory = DatasourceLineage

type DataSource struct {
	// Omitting these two at least for now, because sequential IDs == :(
	// Id                int64                  `json:"id"`
	// OrgId             int64                  `json:"orgId"`

	UID         string `json:"uid"`
	Name        string `json:"name"`
	Type        string `json:"type"`
	TypeLogoUrl string `json:"typeLogoUrl"`
	// Access            models.DsAccess        `json:"access"`
	Access            string `json:"access"` // enum: "proxy" | "direct"
	Url               string `json:"url"`
	Password          string `json:"password"`
	User              string `json:"user"`
	Database          string `json:"database"`
	BasicAuth         bool   `json:"basicAuth"`
	BasicAuthUser     string `json:"basicAuthUser"`
	BasicAuthPassword string `json:"basicAuthPassword"`
	WithCredentials   bool   `json:"withCredentials"`
	IsDefault         bool   `json:"isDefault"`
	// JsonData          *simplejson.Json       `json:"jsonData,omitempty"`
	JsonData         map[string]interface{} `json:"jsonData,omitempty"`
	SecureJsonFields map[string]bool        `json:"secureJsonFields"`
	Version          int                    `json:"version"`
	ReadOnly         bool                   `json:"readOnly"`
	// AccessControl     accesscontrol.Metadata `json:"accessControl,omitempty"`
	AccessControl map[string]bool `json:"accessControl,omitempty"`
}
