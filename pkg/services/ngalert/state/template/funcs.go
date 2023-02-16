package template

import (
	"encoding/json"
	"fmt"
	"net/url"
	"text/template"
)

type query struct {
	Datasource string `json:"datasource"`
	Expr       string `json:"expr"`
}

var (
	defaultFuncs = template.FuncMap{
		"graphLink": graphLink,
		"tableLink": tableLink,
	}
)

var (
	graphLink = func(data string) string {
		var q query
		if err := json.Unmarshal([]byte(data), &q); err != nil {
			return ""
		}
		datasource := url.QueryEscape(q.Datasource)
		expr := url.QueryEscape(q.Expr)
		return fmt.Sprintf(`/explore?left={"datasource":%[1]q,"queries":[{"datasource":%[1]q,"expr":%q,"instant":false,"range":true,"refId":"A"}],"range":{"from":"now-1h","to":"now"}}`, datasource, expr)
	}
	tableLink = func(data string) string {
		var q query
		if err := json.Unmarshal([]byte(data), &q); err != nil {
			return ""
		}
		datasource := url.QueryEscape(q.Datasource)
		expr := url.QueryEscape(q.Expr)
		return fmt.Sprintf(`/explore?left={"datasource":%[1]q,"queries":[{"datasource":%[1]q,"expr":%q,"instant":true,"range":false,"refId":"A"}],"range":{"from":"now-1h","to":"now"}}`, datasource, expr)
	}
)
