package influxdb

import (
	"fmt"
	"strings"
)

var renders map[string]QueryDefinition

type DefinitionParameters struct {
	Name string
	Type string
}

type QueryDefinition struct {
	Renderer func(part *QueryPart, innerExpr string) string
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
		Params:   []DefinitionParameters{{Name: "interval", Type: "time"}},
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

func fieldRenderer(part *QueryPart, innerExpr string) string {
	if part.Params[0] == "*" {
		return "*"
	}
	return fmt.Sprintf(`"%s"`, part.Params[0])
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

func (qp *QueryPart) Render(expr string) string {
	return qp.Def.Renderer(qp, expr)
}
