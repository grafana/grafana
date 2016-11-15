package mqe

import (
	"fmt"

	"strings"

	"github.com/grafana/grafana/pkg/tsdb"
)

type MQEMetric struct {
	Metric string
	Alias  string
}

type MQEQuery struct {
	Metrics        []MQEMetric
	Hosts          []string
	Apps           []string
	AddAppToAlias  bool
	AddHostToAlias bool

	TimeRange   *tsdb.TimeRange
	UseRawQuery bool
	RawQuery    string
}

//`os.disk.sda.io_time` where host in ('staples-lab-1') from 1479197578194 to 1479219178194
func (q *MQEQuery) Build(availableSeries []string) ([]string, error) {
	var queries []string
	where := q.buildWhereClause()

	var metrics []

	for _, v := range q.Metrics {
    if noStar {
				metrics = append(metrics, v)

      continue
    }

		for _, a := range availableSeries {
			if match {
				metrics = append(metrics, a)
			}
		}
	}

	for _, v := range metrics {
		queries = append(queries,
			fmt.Sprintf(
				"`%s` %s from %v to %v",
				v.Metric,
				where,
				q.TimeRange.GetFromAsMsEpoch(),
				q.TimeRange.GetToAsMsEpoch()))
	}

	return queries, nil
}

func (q *MQEQuery) buildWhereClause() string {
	hasApps := len(q.Apps) > 0
	hasHosts := len(q.Hosts) > 0

	where := ""
	if hasHosts || hasApps {
		where += "where "
	}

	if hasApps {
		apps := strings.Join(q.Apps, "', '")
		where += fmt.Sprintf(" apps in ('%s')", apps)
	}

	if hasHosts && hasApps {
		where += " and"
	}

	if hasHosts {
		hosts := strings.Join(q.Hosts, "', '")
		where += fmt.Sprintf(" hosts in ('%s')", hosts)
	}

	return where
}

type TokenBody struct {
	Metrics []string
}

type TokenResponse struct {
	Success bool
	Body    TokenBody
}

type MQEResponse struct {
}
