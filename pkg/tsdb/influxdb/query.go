package influxdb

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/tsdb/interval"
)

var (
	regexpOperatorPattern    = regexp.MustCompile(`^\/.*\/$`)
	regexpMeasurementPattern = regexp.MustCompile(`^\/.*\/$`)
)

func (query *Query) Build(queryContext plugins.DataQuery) (string, error) {
	var res string
	if query.UseRawQuery && query.RawQuery != "" {
		res = query.RawQuery
	} else {
		res = query.renderSelectors(queryContext)
		res += query.renderMeasurement()
		res += query.renderWhereClause()
		res += query.renderTimeFilter(queryContext)
		res += query.renderGroupBy(queryContext)
		res += query.renderTz()
	}

	calculator := interval.NewCalculator(interval.CalculatorOptions{})
	i := calculator.Calculate(*queryContext.TimeRange, query.Interval)

	res = strings.ReplaceAll(res, "$timeFilter", query.renderTimeFilter(queryContext))
	res = strings.ReplaceAll(res, "$interval", i.Text)
	res = strings.ReplaceAll(res, "$__interval_ms", strconv.FormatInt(i.Milliseconds(), 10))
	res = strings.ReplaceAll(res, "$__interval", i.Text)
	return res, nil
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

		// If the operator is missing we fall back to sensible defaults
		if tag.Operator == "" {
			if regexpOperatorPattern.Match([]byte(tag.Value)) {
				tag.Operator = "=~"
			} else {
				tag.Operator = "="
			}
		}

		// quote value unless regex or number
		var textValue string
		switch tag.Operator {
		case "=~", "!~":
			textValue = tag.Value
		case "<", ">":
			textValue = tag.Value
		default:
			textValue = fmt.Sprintf("'%s'", strings.ReplaceAll(tag.Value, `\`, `\\`))
		}

		res = append(res, fmt.Sprintf(`%s"%s" %s %s`, str, tag.Key, tag.Operator, textValue))
	}

	return res
}

func isTimeRangeNumeric(tr *plugins.DataTimeRange) bool {
	if _, err := strconv.ParseInt(tr.From, 10, 64); err != nil {
		return false
	}
	if _, err := strconv.ParseInt(tr.To, 10, 64); err != nil {
		return false
	}
	return true
}

func (query *Query) renderTimeFilter(queryContext plugins.DataQuery) string {
	// If from expressions
	if isTimeRangeNumeric(queryContext.TimeRange) {
		from, to, err := epochMStoInfluxTime(queryContext.TimeRange)
		if err == nil {
			return fmt.Sprintf(" time > %s and time < %s ", from, to)
		}

		// on error fallback to original time range processing.
		glog.Warn("failed to parse expected time range in query, falling back to non-expression time range processing", "error", err)
	}

	// else from dashboard alerting
	from := "now() - " + queryContext.TimeRange.From
	to := ""

	if queryContext.TimeRange.To != "now" && queryContext.TimeRange.To != "" {
		to = " and time < now() - " + strings.Replace(queryContext.TimeRange.To, "now-", "", 1)
	}

	return fmt.Sprintf("time > %s%s", from, to)
}

func (query *Query) renderSelectors(queryContext plugins.DataQuery) string {
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
	var policy string
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

func (query *Query) renderGroupBy(queryContext plugins.DataQuery) string {
	groupBy := ""
	for i, group := range query.GroupBy {
		if i == 0 {
			groupBy += " GROUP BY"
		}

		if i > 0 && group.Type != "fill" {
			groupBy += ", " // fill is so very special. fill is a creep, fill is a weirdo
		} else {
			groupBy += " "
		}

		groupBy += group.Render(query, queryContext, "")
	}

	return groupBy
}

func (query *Query) renderTz() string {
	tz := query.Tz
	if tz == "" {
		return ""
	}
	return fmt.Sprintf(" tz('%s')", tz)
}

func epochMStoInfluxTime(tr *plugins.DataTimeRange) (string, string, error) {
	from, err := strconv.ParseInt(tr.From, 10, 64)
	if err != nil {
		return "", "", err
	}

	to, err := strconv.ParseInt(tr.To, 10, 64)
	if err != nil {
		return "", "", err
	}

	return fmt.Sprintf("%dms", from), fmt.Sprintf("%dms", to), nil
}
