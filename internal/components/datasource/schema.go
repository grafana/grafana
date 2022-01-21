package datasource

import (
	"embed"

	"cuelang.org/go/cue"
	"github.com/grafana/grafana/pkg/schema"
	"github.com/grafana/thema"
	"github.com/grafana/thema/load"
)

var sch *schema.ThemaSchema

func RegisterDatasourceSchema(lib thema.Library, reg *schema.CoreRegistry) {
	//reg.Store(sch)
	return
}

//go:embed datasource.cue cue.mod
var cueFS embed.FS

func DatasourceLineage(lib thema.Library, opts ...thema.BindOption) (thema.Lineage, error) {
	linval, err := loadDatasourceLineage(lib)
	if err != nil {
		return nil, err
	}
	return thema.BindLineage(linval, lib, opts...)
}

func loadDatasourceLineage(lib thema.Library) (cue.Value, error) {
	inst, err := load.InstancesWithThema(cueFS, ".")
	if err != nil {
		return cue.Value{}, err
	}

	val := lib.Context().BuildInstance(inst)
	return val.LookupPath(cue.MakePath(cue.Str("lin"))), nil
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
	//WithCredentials   bool   `json:"withCredentials"`
	//IsDefault         bool   `json:"isDefault"`
	// JsonData          *simplejson.Json       `json:"jsonData,omitempty"`
	JsonData         map[string]interface{} `json:"jsonData,omitempty"`
	SecureJsonFields map[string]bool        `json:"secureJsonFields"`
	//Version          int                    `json:"version"`
	//ReadOnly         bool                   `json:"readOnly"`
	// AccessControl     accesscontrol.Metadata `json:"accessControl,omitempty"`
	//AccessControl map[string]bool `json:"accessControl,omitempty"`
}
