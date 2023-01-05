package state

import (
	"encoding/json"
	"fmt"
	"net/url"
	text_template "text/template"
)

// FuncMap is a map of custom functions we use for templates.
var FuncMap = text_template.FuncMap{
	"graphLink": graphLink,
	"tableLink": tableLink,
	"strvalue":  strValue,
}

func graphLink(rawQuery string) string {
	var q query
	if err := json.Unmarshal([]byte(rawQuery), &q); err != nil {
		return ""
	}

	escapedExpression := url.QueryEscape(q.Expr)
	escapedDatasource := url.QueryEscape(q.Datasource)

	return fmt.Sprintf(
		`/explore?left={"datasource":%[1]q,"queries":[{"datasource":%[1]q,"expr":%q,"instant":false,"range":true,"refId":"A"}],"range":{"from":"now-1h","to":"now"}}`, escapedDatasource, escapedExpression)
}

func tableLink(rawQuery string) string {
	var q query
	if err := json.Unmarshal([]byte(rawQuery), &q); err != nil {
		return ""
	}

	escapedExpression := url.QueryEscape(q.Expr)
	escapedDatasource := url.QueryEscape(q.Datasource)

	return fmt.Sprintf(
		`/explore?left={"datasource":%[1]q,"queries":[{"datasource":%[1]q,"expr":%q,"instant":true,"range":false,"refId":"A"}],"range":{"from":"now-1h","to":"now"}}`, escapedDatasource, escapedExpression)
}

// This function is a no-op for now.
func strValue(value templateCaptureValue) string {
	return ""
}
