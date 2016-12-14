package mqe

import (
	"fmt"

	"strings"

	"regexp"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/tsdb"
)

type Metric struct {
	Metric string
	Alias  string
}

type Query struct {
	Metrics           []Metric
	Hosts             []string
	Cluster           []string
	AddClusterToAlias bool
	AddHostToAlias    bool

	TimeRange   *tsdb.TimeRange
	UseRawQuery bool
	RawQuery    string
}

var (
	containsWildcardPattern *regexp.Regexp = regexp.MustCompile(`\*`)
)

func (q *Query) Build(availableSeries []string) ([]QueryToSend, error) {
	var queriesToSend []QueryToSend
	where := q.buildWhereClause()

	for _, v := range q.Metrics {
		if !containsWildcardPattern.Match([]byte(v.Metric)) {
			alias := ""
			if v.Alias != "" {
				alias = fmt.Sprintf(" {%s}", v.Alias)
			}
			rawQuery := fmt.Sprintf(
				"`%s`%s %s from %v to %v",
				v.Metric,
				alias,
				where,
				q.TimeRange.GetFromAsMsEpoch(),
				q.TimeRange.GetToAsMsEpoch())
			queriesToSend = append(queriesToSend, QueryToSend{
				RawQuery: rawQuery,
				QueryRef: q,
			})
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
				alias := ""
				if v.Alias != "" {
					alias = fmt.Sprintf(" {%s}", v.Alias)
				}

				rawQuery := fmt.Sprintf(
					"`%s`%s %s from %v to %v",
					a,
					alias,
					where,
					q.TimeRange.GetFromAsMsEpoch(),
					q.TimeRange.GetToAsMsEpoch())

				queriesToSend = append(queriesToSend, QueryToSend{
					RawQuery: rawQuery,
					QueryRef: q,
				})
			}
		}
	}
	return queriesToSend, nil
}

func (q *Query) buildWhereClause() string {
	hasApps := len(q.Cluster) > 0
	hasHosts := len(q.Hosts) > 0

	where := ""
	if hasHosts || hasApps {
		where += "where "
	}

	if hasApps {
		apps := strings.Join(q.Cluster, "', '")
		where += fmt.Sprintf("cluster in ('%s')", apps)
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
