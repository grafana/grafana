package influxdb

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"regexp"

	"github.com/grafana/grafana/pkg/tsdb"
)

var (
	regexpOperatorPattern    *regexp.Regexp = regexp.MustCompile(`^\/.*\/$`)
	regexpMeasurementPattern *regexp.Regexp = regexp.MustCompile(`^\/.*\/$`)
)

func (query *Query) Build(queryContext *tsdb.QueryContext) (string, error) {
	var res string

	if query.UseRawQuery && query.RawQuery != "" {
		res = query.RawQuery
	} else {
		res = query.renderSelectors(queryContext)
		res += query.renderMeasurement()
		res += query.renderWhereClause()
		res += query.renderTimeFilter(queryContext)
		res += query.renderGroupBy(queryContext)
	}

	interval, err := getDefinedInterval(query, queryContext)
	if err != nil {
		return "", err
	}

	res = strings.Replace(res, "$timeFilter", query.renderTimeFilter(queryContext), -1)
	res = strings.Replace(res, "$interval", interval.Text, -1)
	res = strings.Replace(res, "$__interval_ms", strconv.FormatInt(interval.Value.Nanoseconds()/int64(time.Millisecond), 10), -1)
	res = strings.Replace(res, "$__interval", interval.Text, -1)
	return res, nil
}

func getDefinedInterval(query *Query, queryContext *tsdb.QueryContext) (*tsdb.Interval, error) {
	defaultInterval := tsdb.CalculateInterval(queryContext.TimeRange)

	if query.Interval == "" {
		return &defaultInterval, nil
	}

	setInterval := strings.Replace(strings.Replace(query.Interval, "<", "", 1), ">", "", 1)
	parsedSetInterval, err := time.ParseDuration(setInterval)

	if err != nil {
		return nil, err
	}

	if strings.Contains(query.Interval, ">") {
		if defaultInterval.Value > parsedSetInterval {
			return &defaultInterval, nil
		}
	}

	return &tsdb.Interval{Value: parsedSetInterval, Text: setInterval}, nil
}

func (query *Query) renderTags() []string {
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

		//If the operator is missing we fall back to sensible defaults
		if tag.Operator == "" {
			if regexpOperatorPattern.Match([]byte(tag.Value)) {
				tag.Operator = "=~"
			} else {
				tag.Operator = "="
			}
		}

		textValue := ""

		// quote value unless regex or number
		if tag.Operator == "=~" || tag.Operator == "!~" {
			textValue = tag.Value
		} else if tag.Operator == "<" || tag.Operator == ">" {
			textValue = tag.Value
		} else {
			textValue = fmt.Sprintf("'%s'", tag.Value)
		}

		res = append(res, fmt.Sprintf(`%s"%s" %s %s`, str, tag.Key, tag.Operator, textValue))
	}

	return res
}

func (query *Query) renderTimeFilter(queryContext *tsdb.QueryContext) string {
	from := "now() - " + queryContext.TimeRange.From
	to := ""

	if queryContext.TimeRange.To != "now" && queryContext.TimeRange.To != "" {
		to = " and time < now() - " + strings.Replace(queryContext.TimeRange.To, "now-", "", 1)
	}

	return fmt.Sprintf("time > %s%s", from, to)
}

func (query *Query) renderSelectors(queryContext *tsdb.QueryContext) string {
	res := "SELECT "

	var selectors []string
	for _, sel := range query.Selects {

		stk := ""
		for _, s := range *sel {
			stk = s.Render(query, queryContext, stk)
		}
		selectors = append(selectors, stk)
	}

	return res + strings.Join(selectors, ", ")
}

func (query *Query) renderMeasurement() string {
	policy := ""
	if query.Policy == "" || query.Policy == "default" {
		policy = ""
	} else {
		policy = `"` + query.Policy + `".`
	}

	measurement := query.Measurement

	if !regexpMeasurementPattern.Match([]byte(measurement)) {
		measurement = fmt.Sprintf(`"%s"`, measurement)
	}

	return fmt.Sprintf(` FROM %s%s`, policy, measurement)
}

func (query *Query) renderWhereClause() string {
	res := " WHERE "
	conditions := query.renderTags()
	if len(conditions) > 0 {
		if len(conditions) > 1 {
			res += "(" + strings.Join(conditions, " ") + ")"
		} else {
			res += conditions[0]
		}
		res += " AND "
	}

	return res
}

func (query *Query) renderGroupBy(queryContext *tsdb.QueryContext) string {
	groupBy := ""
	for i, group := range query.GroupBy {
		if i == 0 {
			groupBy += " GROUP BY"
		}

		if i > 0 && group.Type != "fill" {
			groupBy += ", " //fill is so very special. fill is a creep, fill is a weirdo
		} else {
			groupBy += " "
		}

		groupBy += group.Render(query, queryContext, "")
	}

	return groupBy
}
