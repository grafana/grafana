package labelsuggestion

import (
	"regexp"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

type UserLabels struct {
	Email       string
	LabelNames  map[string]int
	LabelValues map[string]map[LabelSearch]int
}

var labelsRegexp = regexp.MustCompile(`(?P<name>\w+)\s*(=|!=|=~|!~)\s*["'](?P<value>[\w-]+)["']`)

func Extract(queries *simplejson.Json) map[string]map[LabelSearch]int {
	jdoc, err := queries.Array()
	if err != nil || len(jdoc) == 0 {
		return nil
	}

	labels := make([][2]interface{}, 0)
	for _, query := range jdoc {
		if queryMap, ok := query.(map[string]interface{}); ok {
			labels = append(labels, extractQueryLabels(queryMap)...)
		}
	}

	d := make(map[string]map[LabelSearch]int)
	for _, pair := range labels {
		name := pair[0].(string)
		search := pair[1].(LabelSearch)
		if _, exists := d[name]; !exists {
			d[name] = make(map[LabelSearch]int)
		}
		if _, exists := d[name][search]; !exists {
			d[name][search] = 1
		} else {
			d[name][search] += 1
		}
	}

	if len(d) == 0 {
		return nil
	}
	return d
}

func extractQueryLabels(query map[string]interface{}) [][2]interface{} {
	ds, dsOk := query["datasource"].(map[string]interface{})
	if !dsOk || (ds["type"] != "prometheus" && ds["type"] != "loki") || query["expr"] == nil {
		return nil
	}

	expr, exprOk := query["expr"].(string)
	if !exprOk {
		return nil
	}

	matches := labelsRegexp.FindAllStringSubmatch(expr, -1)
	labels := make([][2]interface{}, 0)
	for _, match := range matches {
		if len(match) < 3 {
			continue
		}
		name := match[1]
		matchType := match[2]
		value := match[3]
		labels = append(labels, [2]interface{}{name, LabelSearch{MatchType: matchType, Value: value}})
	}
	return labels
}

// func main() {
// 	// Example usage
// 	queries, err := simplejson.NewJson([]byte(`[{"datasource": {"type": "prometheus"}, "expr": "your expression here"}]`))
// 	if err != nil {
// 		panic(err)
// 	}
// 	extractor := LabelExtractor{}
// 	extractedLabels := extractor.Extract(queries)

// 	// Process user labels
// 	userLabels := make(map[string]UserLabels)
// 	for email, ls := range extractedLabels {
// 		ul, exists := userLabels[email]
// 		if !exists {
// 			ul = UserLabels{
// 				Email:       email,
// 				LabelNames:  make(map[string]int),
// 				LabelValues: make(map[string]map[LabelSearch]int),
// 			}
// 		}

// 		for lname, searches := range ls {
// 			ul.LabelNames[lname]++
// 			for search := range searches {
// 				if _, exists := ul.LabelValues[lname]; !exists {
// 					ul.LabelValues[lname] = make(map[LabelSearch]int)
// 				}
// 				ul.LabelValues[lname][search]++
// 			}
// 		}
// 		userLabels[email] = ul
// 	}
// }
