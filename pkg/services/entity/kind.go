package entity

// User defined properties
type EntityKind struct {
	ID          string `json:"id"`
	Description string `json:"description,omitempty"`
	FileSuffix  string `json:"suffix"` // "-dash.json"
	Category    string `json:"category,omitempty"`
	Plugin      string `json:"plugin,omitempty"` // the plugin that knows how to read/write the object
}

var kinds = []EntityKind{
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
		FileSuffix: "-ds.json",
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
		FileSuffix:  "-dqf.json",
		Category:    "Data",
	},
	{
		ID:         "GeoJSON",
		FileSuffix: ".geojson",
		Category:   "Data",
	},
	// Images
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
