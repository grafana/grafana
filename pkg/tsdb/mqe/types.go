package mqe

import (
	"github.com/grafana/grafana/pkg/tsdb"
)

type MQEQuery struct {
	Metrics []string
	Hosts   []string
	Apps    []string
}

func (q *MQEQuery) Build(queryContext *tsdb.QueryContext) string {
	return ""
}

type TokenBody struct {
	Functions []string
	Metrics   []string
	//tagset
}

type TokenResponse struct {
	Success bool
	Body    TokenBody
}
