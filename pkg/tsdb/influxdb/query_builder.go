package influxdb

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/tsdb"
)

type QueryBuilder struct{}

func renderTags(query *Query) []string {
	var res []string
	for i, tag := range query.Tags {
		str := ""

		if i > 0 {
			if tag.Condition == "" {
				str += "AND"
			} else {
				str += tag.Condition
			}
			str += " "
		}

		res = append(res, fmt.Sprintf(`%s"%s" %s '%s'`, str, tag.Key, tag.Operator, tag.Value))
	}

	return res
}

func (*QueryBuilder) Build(query *Query, queryContext *tsdb.QueryContext) (string, error) {
	res := renderSelectors(query)
	res += renderMeasurement(query)
	res += renderWhereClause(query)
	res += renderTimeFilter(query, queryContext)
	res += renderGroupBy(query)

	return res, nil
}

func renderTimeFilter(query *Query, queryContext *tsdb.QueryContext) string {
	from := "now() - " + queryContext.TimeRange.From
	to := ""

	if queryContext.TimeRange.To != "now" && queryContext.TimeRange.To != "" {
		to = " and time < now() - " + strings.Replace(queryContext.TimeRange.To, "now-", "", 1)
	}

	return fmt.Sprintf("time > %s%s", from, to)
}

func renderSelectors(query *Query) string {
	res := "SELECT "

	var selectors []string
	for _, sel := range query.Selects {

		stk := ""
		for _, s := range *sel {
			stk = s.Render(stk)
		}
		selectors = append(selectors, stk)
	}

	return res + strings.Join(selectors, ", ")
}

func renderMeasurement(query *Query) string {
	policy := ""
	if query.Policy == "" || query.Policy == "default" {
		policy = ""
	} else {
		policy = `"` + query.Policy + `".`
	}
	return fmt.Sprintf(` FROM %s"%s"`, policy, query.Measurement)
}

func renderWhereClause(query *Query) string {
	res := " WHERE "
	conditions := renderTags(query)
	res += strings.Join(conditions, " ")
	if len(conditions) > 0 {
		res += " AND "
	}

	return res
}

func renderGroupBy(query *Query) string {
	var groupBy []string
	for _, group := range query.GroupBy {
		groupBy = append(groupBy, group.Render(""))
	}

	if len(groupBy) > 0 {
		return " GROUP BY " + strings.Join(groupBy, " ")
	}

	return ""
}
