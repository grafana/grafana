package influxdb

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/tsdb"
)

var renders map[string]QueryDefinition

type DefinitionParameters struct {
	Name string
	Type string
}

type QueryDefinition struct {
	Renderer func(query *Query, queryContext *tsdb.TsdbQuery, part *QueryPart, innerExpr string) string
	Params   []DefinitionParameters
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
	renders["mode"] = QueryDefinition{Renderer: functionRenderer}

	renders["holt_winters"] = QueryDefinition{
		Renderer: functionRenderer,
		Params:   []DefinitionParameters{{Name: "number", Type: "number"}, {Name: "season", Type: "number"}},
	}
	renders["holt_winters_with_fit"] = QueryDefinition{
		Renderer: functionRenderer,
		Params:   []DefinitionParameters{{Name: "number", Type: "number"}, {Name: "season", Type: "number"}},
	}

	renders["derivative"] = QueryDefinition{
		Renderer: functionRenderer,
		Params:   []DefinitionParameters{{Name: "duration", Type: "interval"}},
	}

	renders["non_negative_derivative"] = QueryDefinition{
		Renderer: functionRenderer,
		Params:   []DefinitionParameters{{Name: "duration", Type: "interval"}},
	}
	renders["difference"] = QueryDefinition{Renderer: functionRenderer}
	renders["moving_average"] = QueryDefinition{
		Renderer: functionRenderer,
		Params:   []DefinitionParameters{{Name: "window", Type: "number"}},
	}
	renders["stddev"] = QueryDefinition{Renderer: functionRenderer}
	renders["time"] = QueryDefinition{
		Renderer: functionRenderer,
		Params:   []DefinitionParameters{{Name: "interval", Type: "time"}, {Name: "offset", Type: "time"}},
	}
	renders["fill"] = QueryDefinition{
		Renderer: functionRenderer,
		Params:   []DefinitionParameters{{Name: "fill", Type: "string"}},
	}
	renders["elapsed"] = QueryDefinition{
		Renderer: functionRenderer,
		Params:   []DefinitionParameters{{Name: "duration", Type: "interval"}},
	}
	renders["bottom"] = QueryDefinition{
		Renderer: functionRenderer,
		Params:   []DefinitionParameters{{Name: "count", Type: "int"}},
	}

	renders["first"] = QueryDefinition{Renderer: functionRenderer}
	renders["last"] = QueryDefinition{Renderer: functionRenderer}
	renders["max"] = QueryDefinition{Renderer: functionRenderer}
	renders["min"] = QueryDefinition{Renderer: functionRenderer}
	renders["percentile"] = QueryDefinition{
		Renderer: functionRenderer,
		Params:   []DefinitionParameters{{Name: "nth", Type: "int"}},
	}
	renders["top"] = QueryDefinition{
		Renderer: functionRenderer,
		Params:   []DefinitionParameters{{Name: "count", Type: "int"}},
	}
	renders["tag"] = QueryDefinition{
		Renderer: fieldRenderer,
		Params:   []DefinitionParameters{{Name: "tag", Type: "string"}},
	}

	renders["math"] = QueryDefinition{Renderer: suffixRenderer}
	renders["alias"] = QueryDefinition{Renderer: aliasRenderer}
}

func fieldRenderer(query *Query, queryContext *tsdb.TsdbQuery, part *QueryPart, innerExpr string) string {
	if part.Params[0] == "*" {
		return "*"
	}
	return fmt.Sprintf(`"%s"`, part.Params[0])
}

func functionRenderer(query *Query, queryContext *tsdb.TsdbQuery, part *QueryPart, innerExpr string) string {
	for i, param := range part.Params {
		if part.Type == "time" && param == "auto" {
			part.Params[i] = "$__interval"
		}
	}

	if innerExpr != "" {
		part.Params = append([]string{innerExpr}, part.Params...)
	}

	params := strings.Join(part.Params, ", ")

	return fmt.Sprintf("%s(%s)", part.Type, params)
}

func suffixRenderer(query *Query, queryContext *tsdb.TsdbQuery, part *QueryPart, innerExpr string) string {
	return fmt.Sprintf("%s %s", innerExpr, part.Params[0])
}

func aliasRenderer(query *Query, queryContext *tsdb.TsdbQuery, part *QueryPart, innerExpr string) string {
	return fmt.Sprintf(`%s AS "%s"`, innerExpr, part.Params[0])
}

func (r QueryDefinition) Render(query *Query, queryContext *tsdb.TsdbQuery, part *QueryPart, innerExpr string) string {
	return r.Renderer(query, queryContext, part, innerExpr)
}

func NewQueryPart(typ string, params []string) (*QueryPart, error) {
	def, exist := renders[typ]

	if !exist {
		return nil, fmt.Errorf("Missing query definition for %s", typ)
	}

	return &QueryPart{
		Type:   typ,
		Params: params,
		Def:    def,
	}, nil
}

type QueryPart struct {
	Def    QueryDefinition
	Type   string
	Params []string
}

func (qp *QueryPart) Render(query *Query, queryContext *tsdb.TsdbQuery, expr string) string {
	return qp.Def.Renderer(query, queryContext, qp, expr)
}
