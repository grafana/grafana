package nanogit

type GitAddress struct {
	Owner  string `json:"owner"`
	Repo   string `json:"repo"`
	Branch string `json:"branch,omitempty"`
}

// Added to dataframe response metadata
type GetFrameMeta struct {
	Address   GitAddress `json:"address,omitempty"`
	BytesRead int        `json:"bytesRead,omitempty"`
}
