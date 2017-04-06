package models

//ActiveNode model
type ActiveNode struct {
	Id        int64  `json:"id"`
	NodeId    string `json:"node_id"`
	Heartbeat int64  `json:"heartbeat"`
	Sequence  int32  `json:"sequence"`
}

type GetActiveNodeByIDQuery struct {
	Id     int64
	Result []*ActiveNode
}

type SaveActiveNodeCommand struct {
	ActiveNode []*ActiveNode
}
