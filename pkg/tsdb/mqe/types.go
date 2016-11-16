package mqe

import (
	"fmt"

	"strings"

	"regexp"

	"github.com/grafana/grafana/pkg/log"
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

var (
	containsWildcardPattern *regexp.Regexp = regexp.MustCompile(`\*`)
)

func (q *MQEQuery) Build(availableSeries []string) ([]string, error) {
	var queries []string
	where := q.buildWhereClause()

	var metrics []string

	for _, v := range q.Metrics {
		if !containsWildcardPattern.Match([]byte(v.Metric)) {
			metrics = append(metrics, v.Metric)
			continue
		}

		m := strings.Replace(v.Metric, "*", ".*", -1)
		mp, err := regexp.Compile(m)

		if err != nil {
			log.Error2("failed to compile regex for ", "metric", m)
			continue
		}

		//TODO: this lookup should be cached
		for _, a := range availableSeries {
			if mp.Match([]byte(a)) {
				metrics = append(metrics, a)
			}
		}
	}

	for _, metric := range metrics {
		queries = append(queries,
			fmt.Sprintf(
				"`%s` %s from %v to %v",
				metric,
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
		where += fmt.Sprintf("app in ('%s')", apps)
	}

	if hasHosts && hasApps {
		where += " and "
	}

	if hasHosts {
		hosts := strings.Join(q.Hosts, "', '")
		where += fmt.Sprintf("host in ('%s')", hosts)
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
