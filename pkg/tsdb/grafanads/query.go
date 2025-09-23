package grafanads

const (
	// QueryTypeRandomWalk returns a random walk series
	queryTypeRandomWalk = "randomWalk"

	// QueryTypeList will list the files in a folder
	queryTypeSearch = "search"

	// queryTypeSearchNext will perform a search query using the next generation search service
	queryTypeSearchNext = "searchNext"

	// QueryTypeList will list the files in a folder
	queryTypeList = "list"

	// QueryTypeRead will read a file and return it as data frames
	// currently only .csv files are supported,
	// other file types will eventually be supported (parquet, etc)
	queryTypeRead = "read"
)

type listQueryModel struct {
	Path string `json:"path"`
}
type readQueryModel struct {
	Path string `json:"path"`
}
