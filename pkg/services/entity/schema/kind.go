package schema

import "github.com/grafana/grafana-plugin-sdk-go/data"

// User defined properties
type EntityKindInfo struct {
	ID                   string `json:"id"`
	Description          string `json:"description,omitempty"`
	FileSuffix           string `json:"suffix"` // "-dash.json"
	Category             string `json:"category,omitempty"`
	Plugin               string `json:"plugin,omitempty"` // the plugin that knows how to read/write the object
	CurrentSchemaVersion string `json:"currentSchemaVersion,omitempty"`
	IsJSON               bool   `json:"isJSON,omitempty"`
	IsBuiltin            bool   `json:"isBuiltin,omitempty"` // add ext
}

type ValidationInfo struct {
	Valid         bool          `json:"valid"`
	SchemaVersion string        `json:"schemaVersion,omitempty"`
	Info          []data.Notice `json:"info,omitempty"`    // ERROR, WARNING
	Details       interface{}   `json:"details,omitempty"` // if the system has a known details format
}

type KindHandler interface {
	Info() EntityKindInfo
	GetSchema(schemaVersion string) SchemaHandler // empty will give you the current one
	ListVersions() []string                       // list possible schema versions
}

type SchemaHandler interface {
	Validate(body []byte) ValidationInfo
	Sanitize(body []byte) ([]byte, ValidationInfo)
	Migrate(body []byte, fromVersion string) ([]byte, ValidationInfo)
	GetJSONSchema() []byte // the schema we can pass to monaco editor
}

type KindRegistry interface {
	Register(k KindHandler) error
	GetKind(k string) KindHandler
	List() EntityKindInfo
}

var kinds = []EntityKindInfo{
	{
		ID:         "dashboard",
		FileSuffix: "-dash.json",
	},
	{
		ID:         "alert",
		FileSuffix: "-alert.json",
	},
	{
		ID:         "datasource",
		FileSuffix: "-ds.json",
	},
	{
		ID:         "playlist",
		FileSuffix: "-playlist.json",
	},
	// Data
	{
		ID:         "dataFrame",
		FileSuffix: "-df.json",
		Category:   "Data",
	},
	{
		ID:          "dataQueryResponse",
		Description: "query result format",
		FileSuffix:  "-dqr.json",
		Category:    "Data",
	},
	{
		ID:         "GeoJSON",
		FileSuffix: ".geojson",
		Category:   "Data",
	},
	{
		ID:         "WorldMap location lookup",
		FileSuffix: "-wm.json",
		Category:   "Data",
	},
	// Images (binary)
	{
		ID:         "SVG",
		FileSuffix: ".svg",
		Category:   "Image",
	},
	{
		ID:         "PNG",
		FileSuffix: ".png",
		Category:   "Image",
	},
	{
		ID:         "GIF",
		FileSuffix: ".gif",
		Category:   "Image",
	},
}

func GetXXX() {
	for _, k := range kinds {

	}
}
