package template

import (
	"encoding/json"
	"fmt"
	"net/url"
	"regexp"
	"sort"
	"strings"
	"text/template"
)

type query struct {
	Datasource string `json:"datasource"`
	Expr       string `json:"expr"`
}

var (
	defaultFuncs = template.FuncMap{
		"filterLabels":      filterLabelsFunc,
		"filterLabelsRe":    filterLabelsReFunc,
		"graphLink":         graphLinkFunc,
		"removeLabels":      removeLabelsFunc,
		"removeLabelslRe":   removeLabelsReFunc,
		"tableLink":         tableLinkFunc,
		"deduplicateLabels": deduplicateLabelsFunc,
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

func deduplicateLabelsFunc(values map[string]Value) Labels {
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
		sort.Strings(keys)
		res[label] = strings.Join(keys, ", ")
	}
	return res
}
