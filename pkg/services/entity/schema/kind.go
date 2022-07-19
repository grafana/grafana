package schema

import (
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// User defined properties
type EntityKindInfo struct {
	ID                   string `json:"id"`
	Description          string `json:"description,omitempty"`
	FileSuffix           string `json:"suffix"` // "-dash.json"
	Category             string `json:"category,omitempty"`
	CurrentSchemaVersion string `json:"currentSchemaVersion,omitempty"`
	IsJSON               bool   `json:"isJSON,omitempty"`

	//	Plugin               string `json:"plugin,omitempty"` // the plugin that knows how to read/write an object
}

type ValidationRequest struct {
	SchemaVersion string `json:"schemaVersion"`
	Body          []byte `json:"body"`

	ExtractDependencies bool `json:"extractDependencies,omitempty"`
	IncludeDetails      bool `json:"includeDetails,omitempty"`
	Sanitize            bool `json:"sanitize,omitempty"`
}

type ValidationResponse struct {
	Valid             bool          `json:"valid"`
	SchemaVersion     string        `json:"schemaVersion,omitempty"`
	Info              []data.Notice `json:"info,omitempty"`    // Show errors or warnings
	ValidationDetails interface{}   `json:"details,omitempty"` // if the system has a known details format
	Dependencies      []string      `json:"dependencies,omitempty"`
	SanitizedBody     []byte        `json:"sanitized,omitempty"`
}

type KindHandler interface {
	Info() EntityKindInfo
	GetSchemaVersions() []string // list possible schema versions

	Validate(opts ValidationRequest) ValidationResponse
	Migrate(opts ValidationRequest, targetVersion string) ValidationResponse
	GetJSONSchema(schemaVersion string) []byte // the schema we can pass to monaco editor
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
	{
		ID:          "annotation",
		Description: "Single annotation event",
		FileSuffix:  "-anno.json",
	},
	// ???
	{
		ID:         "readme",
		FileSuffix: "README.md",
	},
	{
		ID:         "folder",
		FileSuffix: "__folder.json",
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
		ID:         "CSV",
		FileSuffix: ".csv",
		Category:   "Data",
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
		ID:         "JPEG",
		FileSuffix: ".jpg",
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
		fmt.Printf("%+v\n", k)
	}
}
