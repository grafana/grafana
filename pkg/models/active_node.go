package models

//ActiveNode model
type ActiveNode struct {
	Id           int64  `json:"id"`
	NodeId       string `json:"node_id"`
	Heartbeat    int64  `json:"heartbeat"`
	PartitionNo  int32  `json:"partition_no"`
	AlertRunType string `json:"alert_run_type"`
	AlertStatus  string `json:"alert_status"`
}

const (
	CLN_ALERT_RUN_TYPE_MISSING  = "missing"
	CLN_ALERT_RUN_TYPE_NORMAL   = "normal"
	CLN_ALERT_STATUS_READY      = "ready"
	CLN_ALERT_STATUS_PROCESSING = "processing"
	CLN_ALERT_STATUS_SCHEDULING = "scheduling"
)

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

type SaveNodeProcessingMissingAlertCommand struct {
	Node   *ActiveNode
	Result *ActiveNode
}

type GetNodeCmd struct {
	Node   *ActiveNode
	Result *ActiveNode
}

type GetLastDBTimeIntervalQuery struct {
	Result int64
}
