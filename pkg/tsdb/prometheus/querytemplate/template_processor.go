package querytemplate

import (
	"fmt"
	"time"

	"github.com/prometheus/prometheus/model/labels"
	"github.com/prometheus/prometheus/promql/parser"
)

type QueryTemplateProcessor struct {
	LabelWithValueCounter map[string]string
	LabelNoValueCounter   map[string]int
	expr                  string
	ast                   parser.Expr
	TemplateExpr          string
}

func NewQueryTemplateProcessor(expr string) *QueryTemplateProcessor {
	ast, err := parser.ParseExpr(expr)
	if err != nil {
		fmt.Println("Error parsing query:", err)
		return &QueryTemplateProcessor{}
	}
	q := &QueryTemplateProcessor{
		LabelWithValueCounter: make(map[string]string),
		LabelNoValueCounter:   make(map[string]int),
		expr:                  expr,
		ast:                   ast,
	}

	q.TemplateExpr = q.render(q.ast)
	return q
}

func (q *QueryTemplateProcessor) render(expr parser.Expr) string {
	parser.Inspect(expr, func(node parser.Node, path []parser.Node) error {

		// res2B, _ := json.Marshal(node)
		// fmt.Println(string(res2B), fmt.Sprintf("%T", node), "\n")
		switch e := node.(type) {
		case *parser.NumberLiteral:
			e.Val = 99
		case *parser.AggregateExpr:
			for _, l := range e.Grouping {
				q.LabelNoValueCounter[l]++
			}
			if len(e.Grouping) > 0 {
				e.Grouping = []string{"label"}
			}
		case *parser.VectorSelector:
			e.Name = "metric"
			if e.OriginalOffset != 0 {
				newOriginalOffset := time.Minute
				e.OriginalOffset = newOriginalOffset
			}
			if e.Timestamp != nil && *e.Timestamp != int64(0) {
				newTimestamp := int64(time.Minute)
				e.Timestamp = &newTimestamp
			}
			for _, l := range e.LabelMatchers {
				if l.Name != "__name__" {
					q.LabelWithValueCounter[l.Name] = l.Value
				}
			}
			if len(e.LabelMatchers) > 1 {
				e.LabelMatchers = []*labels.Matcher{
					&labels.Matcher{
						Name:  "label",
						Type:  labels.MatchEqual,
						Value: "value",
					},
				}
			} else if len(e.LabelMatchers) == 1 {
				e.LabelMatchers = []*labels.Matcher{}
			}

		case *parser.MatrixSelector:
			e.Range = time.Minute
		}
		return nil
	})
	return fmt.Sprint(expr)
}
