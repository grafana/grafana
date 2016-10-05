package influxdb

import (
	"fmt"
	"strings"
)

var renders map[string]QueryDefinition

type QueryDefinition struct {
	Renderer func(part *QueryPart, innerExpr string) string
}

func init() {
	renders = make(map[string]QueryDefinition)

	renders["field"] = QueryDefinition{Renderer: fieldRenderer}

	renders["spread"] = QueryDefinition{Renderer: functionRenderer}
	renders["count"] = QueryDefinition{Renderer: functionRenderer}
	renders["distinct"] = QueryDefinition{Renderer: functionRenderer}
	renders["integral"] = QueryDefinition{Renderer: functionRenderer}
	renders["mean"] = QueryDefinition{Renderer: functionRenderer}
	renders["median"] = QueryDefinition{Renderer: functionRenderer}
	renders["sum"] = QueryDefinition{Renderer: functionRenderer}

	renders["derivative"] = QueryDefinition{
		Renderer: functionRenderer,
		//params: [{ name: "duration", type: "interval", options: ['1s', '10s', '1m', '5m', '10m', '15m', '1h']}],
	}

	renders["non_negative_derivative"] = QueryDefinition{
		Renderer: functionRenderer,
		//params: [{ name: "duration", type: "interval", options: ['1s', '10s', '1m', '5m', '10m', '15m', '1h']}],
	}
	renders["difference"] = QueryDefinition{Renderer: functionRenderer}
	renders["moving_average"] = QueryDefinition{
		Renderer: functionRenderer,
		//params: [{ name: "window", type: "number", options: [5, 10, 20, 30, 40]}]
	}
	renders["stddev"] = QueryDefinition{Renderer: functionRenderer}
	renders["time"] = QueryDefinition{
		Renderer: functionRenderer,
		//params: [{ name: "interval", type: "time", options: ['auto', '1s', '10s', '1m', '5m', '10m', '15m', '1h'] }],
	}
	renders["fill"] = QueryDefinition{
		Renderer: functionRenderer,
		//params: [{ name: "fill", type: "string", options: ['none', 'null', '0', 'previous'] }],
	}
	renders["elapsed"] = QueryDefinition{
		Renderer: functionRenderer,
		//params: [{ name: "duration", type: "interval", options: ['1s', '10s', '1m', '5m', '10m', '15m', '1h']}],
	}
	renders["bottom"] = QueryDefinition{
		Renderer: functionRenderer,
		//params: [{name: 'count', type: 'int'}],
	}

	renders["first"] = QueryDefinition{Renderer: functionRenderer}
	renders["last"] = QueryDefinition{Renderer: functionRenderer}
	renders["max"] = QueryDefinition{Renderer: functionRenderer}
	renders["min"] = QueryDefinition{Renderer: functionRenderer}
	renders["percentile"] = QueryDefinition{
		Renderer: functionRenderer,
		//params: [{name: 'nth', type: 'int'}],
	}
	renders["top"] = QueryDefinition{
		Renderer: functionRenderer,
		//params: [{name: 'count', type: 'int'}],
	}
	renders["tag"] = QueryDefinition{
		Renderer: fieldRenderer,
		//params: [{name: 'tag', type: 'string', dynamicLookup: true}],
	}

	renders["math"] = QueryDefinition{Renderer: suffixRenderer}
	renders["alias"] = QueryDefinition{Renderer: aliasRenderer}
}

func fieldRenderer(part *QueryPart, innerExpr string) string {
	if part.Params[0] == "*" {
		return "*"
	}
	return fmt.Sprintf(`"%v"`, part.Params[0])
}

func functionRenderer(part *QueryPart, innerExpr string) string {
	params := strings.Join(part.Params, ", ")

	if len(part.Params) > 0 {
		return fmt.Sprintf("%s(%s, %s)", part.Type, innerExpr, params)
	}

	return fmt.Sprintf("%s(%s)", part.Type, innerExpr)
}

func suffixRenderer(part *QueryPart, innerExpr string) string {
	return fmt.Sprintf("%s %s", innerExpr, part.Params[0])
}

func aliasRenderer(part *QueryPart, innerExpr string) string {
	return fmt.Sprintf(`%s AS "%s"`, innerExpr, part.Params[0])
}

func (r QueryDefinition) Render(part *QueryPart, innerExpr string) string {
	return r.Renderer(part, innerExpr)
}

type QueryPartDefinition struct {
}

type QueryPart struct {
	Type   string
	Params []string
}

func (qp *QueryPart) Render(expr string) (string, error) {
	renderFn, exist := renders[qp.Type]
	if !exist {
		return "", fmt.Errorf("could not find render strategy %s", qp.Type)
	}

	return renderFn.Renderer(qp, expr), nil
}
