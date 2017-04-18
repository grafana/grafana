package models

//ActiveNode model
type ActiveNode struct {
	Id           int64  `json:"id"`
	NodeId       string `json:"node_id"`
	Heartbeat    int64  `json:"heartbeat"`
	PartitionNo  int32  `json:"partitionNo"`
	AlertRunType string `json:"alertRunType"`
}

type GetActiveNodeByIDQuery struct {
	Id     int64
	Result *ActiveNode
}

type SaveActiveNodeCommand struct {
	Node   *ActiveNode
	Result *ActiveNode
}
