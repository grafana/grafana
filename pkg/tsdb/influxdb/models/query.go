package models

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
)

var (
	regexpOperatorPattern           = regexp.MustCompile(`^\/.*\/$`)
	regexpMeasurementPattern        = regexp.MustCompile(`^\/.*\/$`)
	regexMatcherWithStartEndPattern = regexp.MustCompile(`^/\^(.*)\$/$`)
)

func (query *Query) Build(queryContext *backend.QueryDataRequest) (string, error) {
	var res string
	if query.UseRawQuery && query.RawQuery != "" {
		res = query.RawQuery
	} else {
		res = query.renderSelectors(queryContext)
		res += query.renderMeasurement()
		res += query.renderWhereClause()
		res += query.renderTimeFilter(queryContext)
		res += query.renderGroupBy(queryContext)
		res += query.renderOrderByTime()
		res += query.renderLimit()
		res += query.renderSlimit()
		res += query.renderTz()
	}

	intervalText := gtime.FormatInterval(query.Interval)
	intervalMs := int64(query.Interval / time.Millisecond)

	res = strings.ReplaceAll(res, "$timeFilter", query.renderTimeFilter(queryContext))
	res = strings.ReplaceAll(res, "$interval", intervalText)
	res = strings.ReplaceAll(res, "$__interval_ms", strconv.FormatInt(intervalMs, 10))
	res = strings.ReplaceAll(res, "$__interval", intervalText)

	return res, nil
}

func (query *Query) renderTags() []string {
	res := make([]string, 0, len(query.Tags))
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
			if regexpOperatorPattern.MatchString(tag.Value) {
				tag.Operator = "=~"
			} else {
				tag.Operator = "="
			}
		}

		isOperatorTypeHandler := func(tag *Tag) (string, string) {
			// Attempt to identify the type of the supplied value
			var lowerValue = strings.ToLower(tag.Value)
			var r = regexp.MustCompile(`^(-?)[0-9\.]+$`)
			var textValue string
			var operator string

			// Perform operator replacements
			switch tag.Operator {
			case "Is":
				operator = "="
			case "Is Not":
				operator = "!="
			default:
				// This should never happen
				operator = "="
			}

			// Always quote tag values
			if strings.HasSuffix(tag.Key, "::tag") {
				textValue = fmt.Sprintf("'%s'", strings.ReplaceAll(tag.Value, `\`, `\\`))
				return textValue, operator
			}

			// Try and discern the type of fields
			if lowerValue == "true" || lowerValue == "false" {
				// boolean, don't quote, but make lowercase
				textValue = lowerValue
			} else if r.MatchString(tag.Value) {
				// Integer or float, don't quote
				textValue = tag.Value
			} else {
				// String (or unknown) - quote
				textValue = fmt.Sprintf("'%s'", strings.ReplaceAll(tag.Value, `\`, `\\`))
			}

			return removeRegexWrappers(textValue, `'`), operator
		}

		// quote value unless regex or number
		var textValue string
		switch tag.Operator {
		case "=~", "!~", "":
			textValue = tag.Value
		case "<", ">", ">=", "<=":
			textValue = removeRegexWrappers(tag.Value, `'`)
		case "Is", "Is Not":
			textValue, tag.Operator = isOperatorTypeHandler(tag)
		default:
			textValue = fmt.Sprintf("'%s'", strings.ReplaceAll(removeRegexWrappers(tag.Value, ""), `\`, `\\`))
		}

		escapedKey := fmt.Sprintf(`"%s"`, tag.Key)

		if strings.HasSuffix(tag.Key, "::tag") {
			escapedKey = fmt.Sprintf(`"%s"::tag`, strings.TrimSuffix(tag.Key, "::tag"))
		}

		if strings.HasSuffix(tag.Key, "::field") {
			escapedKey = fmt.Sprintf(`"%s"::field`, strings.TrimSuffix(tag.Key, "::field"))
		}

		res = append(res, fmt.Sprintf(`%s%s %s %s`, str, escapedKey, tag.Operator, textValue))
	}

	return res
}

func (query *Query) renderTimeFilter(queryContext *backend.QueryDataRequest) string {
	from, to := epochMStoInfluxTime(&queryContext.Queries[0].TimeRange)
	return fmt.Sprintf("time >= %s and time <= %s", from, to)
}

func (query *Query) renderSelectors(queryContext *backend.QueryDataRequest) string {
	res := "SELECT "

	selectors := make([]string, 0, len(query.Selects))
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

	if !regexpMeasurementPattern.MatchString(measurement) {
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

func (query *Query) renderGroupBy(queryContext *backend.QueryDataRequest) string {
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

func (query *Query) renderOrderByTime() string {
	orderByTime := query.OrderByTime
	if orderByTime == "" {
		return ""
	}
	return fmt.Sprintf(" ORDER BY time %s", orderByTime)
}

func (query *Query) renderTz() string {
	tz := query.Tz
	if tz == "" {
		return ""
	}
	return fmt.Sprintf(" tz('%s')", tz)
}

func (query *Query) renderLimit() string {
	limit := query.Limit
	if limit == "" {
		return ""
	}
	return fmt.Sprintf(" limit %s", limit)
}

func (query *Query) renderSlimit() string {
	slimit := query.Slimit
	if slimit == "" {
		return ""
	}
	return fmt.Sprintf(" slimit %s", slimit)
}

func epochMStoInfluxTime(tr *backend.TimeRange) (string, string) {
	from := tr.From.UnixNano() / int64(time.Millisecond)
	to := tr.To.UnixNano() / int64(time.Millisecond)

	return fmt.Sprintf("%dms", from), fmt.Sprintf("%dms", to)
}

func removeRegexWrappers(wrappedValue string, wrapper string) string {
	value := wrappedValue
	// get the value only in between /^...$/
	matches := regexMatcherWithStartEndPattern.FindStringSubmatch(wrappedValue)
	if len(matches) > 1 {
		// full match. the value is like /^value$/
		value = wrapper + matches[1] + wrapper
	}

	return value
}
