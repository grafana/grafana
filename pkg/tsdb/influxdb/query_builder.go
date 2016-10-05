package influxdb

import (
	"fmt"
	"strings"
)

type QueryBuild struct{}

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

func (*QueryBuild) Build(query *Query) (string, error) {
	res := "SELECT "

	var selectors []string
	for _, sel := range query.Selects {

		stk := ""
		for _, s := range *sel {
			stk = s.Render(stk)
		}
		selectors = append(selectors, stk)
	}
	res += strings.Join(selectors, ", ")

	policy := ""
	if query.Policy != "" {
		policy = `"` + query.Policy + `".`
	}
	res += fmt.Sprintf(` FROM %s"%s"`, policy, query.Measurement)

	res += " WHERE "
	conditions := renderTags(query)
	res += strings.Join(conditions, " ")
	if len(conditions) > 0 {
		res += " AND "
	}

	res += "$timeFilter"

	var groupBy []string
	for _, group := range query.GroupBy {
		groupBy = append(groupBy, group.Render(""))
	}

	if len(groupBy) > 0 {
		res += " GROUP BY " + strings.Join(groupBy, " ")
	}

	return res, nil
}
