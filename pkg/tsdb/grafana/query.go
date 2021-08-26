package grafana

const (
	// QueryTypeList will list the files in a folder
	QueryTypeList = "list"

	// QueryTypeRead will read a file and return it as data frames
	// currently only .csv files are supported,
	// other file types will eventually be supported (parquet, etc)
	QueryTypeRead = "read"
)

// ListQueryModel will show a directory listing for the given path
type ListQueryModel struct {
	Path string `json:"path"`
}

// LoadQueryModel will load the file at
type LoadQueryModel struct {
	Path string `json:"path"`
}
