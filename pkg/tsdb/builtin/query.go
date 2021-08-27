package builtin

const (
	// QueryTypeRandomWalk retuns a random walk
	queryTypeRandomWalk = "randomwalk"

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
