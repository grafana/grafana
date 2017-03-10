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

type Function struct {
	Func string
}

type Query struct {
	Metrics           []Metric
	Hosts             []string
	Cluster           []string
	FunctionList      []Function
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
	functions := q.buildFunctionList()

	for _, metric := range q.Metrics {
		alias := ""
		if metric.Alias != "" {
			alias = fmt.Sprintf(" {%s}", metric.Alias)
		}

		if !containsWildcardPattern.Match([]byte(metric.Metric)) {
			rawQuery := q.renderQuerystring(metric.Metric, functions, alias, where, q.TimeRange)
			queriesToSend = append(queriesToSend, QueryToSend{
				RawQuery: rawQuery,
				QueryRef: q,
				Metric:   metric,
			})
		} else {
			m := strings.Replace(metric.Metric, "*", ".*", -1)
			mp, err := regexp.Compile(m)

			if err != nil {
				log.Error2("failed to compile regex for ", "metric", m)
				continue
			}

			//TODO: this lookup should be cached
			for _, wildcardMatch := range availableSeries {
				if mp.Match([]byte(wildcardMatch)) {
					rawQuery := q.renderQuerystring(wildcardMatch, functions, alias, where, q.TimeRange)
					queriesToSend = append(queriesToSend, QueryToSend{
						RawQuery: rawQuery,
						QueryRef: q,
						Metric:   metric,
					})
				}
			}
		}
	}

	return queriesToSend, nil
}

func (q *Query) renderQuerystring(path, functions, alias, where string, timerange *tsdb.TimeRange) string {
	return fmt.Sprintf(
		"`%s`%s%s %s from %v to %v",
		path,
		functions,
		alias,
		where,
		q.TimeRange.GetFromAsMsEpoch(),
		q.TimeRange.GetToAsMsEpoch())
}

func (q *Query) buildFunctionList() string {
	functions := ""
	for _, v := range q.FunctionList {
		functions = fmt.Sprintf("%s|%s", functions, v.Func)
	}

	return functions
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
