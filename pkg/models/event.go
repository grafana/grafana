package models

import "github.com/raintank/raintank-metric/schema"

type GetEventsQuery struct {
	OrgId  int64
	Query  string `form:"query"`
	Start  int64  `form:"start"`
	End    int64  `form:"end"`
	Size   int    `form:"size"`
	Result []*schema.ProbeEvent
}
