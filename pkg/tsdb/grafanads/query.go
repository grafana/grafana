package grafanads

const (
	// QueryTypeRandomWalk returns a random walk series
	queryTypeRandomWalk = "randomWalk"

	// QueryTypeList will list the files in a folder
	queryTypeList = "list"
)

type listQueryModel struct {
	Path string `json:"path"`
}
