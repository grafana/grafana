package mqe

import (
	"github.com/grafana/grafana/pkg/tsdb"
)

type MQEMetric struct {
	Metric string
	Alias  string
}

type MQEQuery struct {
	Metrics []MQEMetric
	Hosts   []string
	Apps    []string

	AddAppToAlias  bool
	AddHostToAlias bool
	UseRawQuery    bool
	RawQuery       string
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
