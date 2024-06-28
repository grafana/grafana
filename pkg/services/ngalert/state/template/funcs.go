package template

import (
	"encoding/json"
	"fmt"
	"net/url"
	"regexp"
	"slices"
	"strings"
	"text/template"
)

type query struct {
	Datasource string `json:"datasource"`
	Expr       string `json:"expr"`
}

const (
	FilterLabelFuncName      = "filterLabels"
	FilterLabelReFuncName    = "filterLabelsRe"
	GraphLinkFuncName        = "graphLink"
	RemoveLabelsFuncName     = "removeLabels"
	RemoveLabelsReFuncName   = "removeLabelsRe"
	TableLinkFuncName        = "tableLink"
	MergeLabelValuesFuncName = "mergeLabelValues"
)

var (
	defaultFuncs = template.FuncMap{
		FilterLabelFuncName:      filterLabelsFunc,
		FilterLabelReFuncName:    filterLabelsReFunc,
		GraphLinkFuncName:        graphLinkFunc,
		RemoveLabelsFuncName:     removeLabelsFunc,
		RemoveLabelsReFuncName:   removeLabelsReFunc,
		TableLinkFuncName:        tableLinkFunc,
		MergeLabelValuesFuncName: mergeLabelValuesFunc,
	}
)

// filterLabelsFunc removes all labels that do not match the string.
func filterLabelsFunc(m Labels, match string) Labels {
	res := make(Labels)
	for k, v := range m {
		if k == match {
			res[k] = v
		}
	}
	return res
}

// filterLabelsReFunc removes all labels that do not match the regex.
func filterLabelsReFunc(m Labels, pattern string) Labels {
	re := regexp.MustCompile(pattern)
	res := make(Labels)
	for k, v := range m {
		if re.MatchString(k) {
			res[k] = v
		}
	}
	return res
}

func graphLinkFunc(data string) string {
	var q query
	if err := json.Unmarshal([]byte(data), &q); err != nil {
		return ""
	}
	datasource := url.QueryEscape(q.Datasource)
	expr := url.QueryEscape(q.Expr)
	return fmt.Sprintf(`/explore?left={"datasource":%[1]q,"queries":[{"datasource":%[1]q,"expr":%q,"instant":false,"range":true,"refId":"A"}],"range":{"from":"now-1h","to":"now"}}`, datasource, expr)
}

// removeLabelsFunc removes all labels that match the string.
func removeLabelsFunc(m Labels, match string) Labels {
	res := make(Labels)
	for k, v := range m {
		if k != match {
			res[k] = v
		}
	}
	return res
}

// removeLabelsReFunc removes all labels that match the regex.
func removeLabelsReFunc(m Labels, pattern string) Labels {
	re := regexp.MustCompile(pattern)
	res := make(Labels)
	for k, v := range m {
		if !re.MatchString(k) {
			res[k] = v
		}
	}
	return res
}

func tableLinkFunc(data string) string {
	var q query
	if err := json.Unmarshal([]byte(data), &q); err != nil {
		return ""
	}
	datasource := url.QueryEscape(q.Datasource)
	expr := url.QueryEscape(q.Expr)
	return fmt.Sprintf(`/explore?left={"datasource":%[1]q,"queries":[{"datasource":%[1]q,"expr":%q,"instant":true,"range":false,"refId":"A"}],"range":{"from":"now-1h","to":"now"}}`, datasource, expr)
}

// mergeLabelValuesFunc returns a map of label keys to deduplicated and comma separated values.
func mergeLabelValuesFunc(values map[string]Value) Labels {
	type uniqueLabelVals map[string]struct{}

	labels := make(map[string]uniqueLabelVals)
	for _, value := range values {
		for k, v := range value.Labels {
			var ul uniqueLabelVals
			var ok bool
			if ul, ok = labels[k]; !ok {
				ul = uniqueLabelVals{}
				labels[k] = ul
			}
			ul[v] = struct{}{}
		}
	}

	res := make(Labels)
	for label, vals := range labels {
		keys := make([]string, 0, len(vals))
		for val := range vals {
			keys = append(keys, val)
		}
		slices.Sort(keys)
		res[label] = strings.Join(keys, ", ")
	}
	return res
}
