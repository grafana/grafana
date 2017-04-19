package models

//ActiveNode model
type ActiveNode struct {
	Id           int64  `json:"id"`
	NodeId       string `json:"node_id"`
	Heartbeat    int64  `json:"heartbeat"`
	PartitionNo  int32  `json:"partitionNo"`
	AlertRunType string `json:"alertRunType"`
}

type GetActiveNodeByIdHeartbeatQuery struct {
	NodeId    string
	Heartbeat int64
	Result    *ActiveNode
}

type SaveActiveNodeCommand struct {
	Node        *ActiveNode
	FetchResult bool
	Result      *ActiveNode
}

const (
	MISSING_ALERT = "missing_alert"
	NORMAL_ALERT  = "normal_alert"
)

type SaveNodeProcessingMissingAlertCommand struct {
	Node   *ActiveNode
	Result *ActiveNode
}
type GetNodeCmd struct {
	Node   *ActiveNode
	Result *ActiveNode
}
