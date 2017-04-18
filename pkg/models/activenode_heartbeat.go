package models

//ActiveNodeHeartbeat model
type ActiveNodeHeartbeat struct {
	Id           int64  `json:"id"`
	NodeId       string `json:"node_id"`
	Heartbeat    int64  `json:"heartbeat"`
	PartitionNo  int32  `json:"partitionNo"`
	AlertRunType string `json:"alertRunType"`
}

type GetActiveNodeByIDQuery struct {
	Id     int64
	Result *ActiveNodeHeartbeat
}

type SaveActiveNodeCommand struct {
	Result *ActiveNodeHeartbeat
}

const (
	MISSING_ALERT = "missing_alert"
	NORMAL_ALERT  = "normal_alert"
)

type SaveNodeByIdCmd struct {
	NodeId string
}

type GetNodeProcessingMissingAlertQuery struct {
	Result *ActiveNodeHeartbeat
}
