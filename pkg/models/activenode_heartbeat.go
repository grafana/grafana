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

type GetHeartBeatCmd struct {
	RoundedHeartbeat *int
}

type SaveNodeByAlertTypeCmd struct {
	NodeId       string
	PartitionNo  int32
	AlertRunType string
	Result       *ActiveNodeHeartbeat
}

type GetNodeByAlertTypeAndHeartbeatCmd struct {
	AlertRunType string
	HeartBeat    int64
	PartitionNo  int32
	Result       *ActiveNodeHeartbeat
}
