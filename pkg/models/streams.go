package models

// Duplicat of DTOS???
type StreamMessage struct {
	Stream string                 `json:"stream"`
	Time   int64                  `json:"time"`
	Body   map[string]interface{} `json:"body"`
}

type StreamInfo struct {
	Name string
}

type StreamList []*StreamInfo

type StreamManager interface {
	GetStreamList() StreamList
	Push(data *StreamMessage)
}
