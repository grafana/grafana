package eval

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/expr/classic"
)

func extractEvalString(frame *data.Frame) (s string) {
	if frame == nil {
		return "empty frame"
	}

	if frame.Meta == nil || frame.Meta.Custom == nil {
		return
	}

	if evalMatches, ok := frame.Meta.Custom.([]classic.EvalMatch); ok {
		sb := strings.Builder{}

		for i, m := range evalMatches {
			sb.WriteString("[ ")
			sb.WriteString(fmt.Sprintf("metric='%s' ", m.Metric))
			sb.WriteString(fmt.Sprintf("labels={%s} ", m.Labels))

			valString := "null"
			if m.Value != nil {
				valString = fmt.Sprintf("%v", *m.Value)
			}

			sb.WriteString(fmt.Sprintf("value=%v ", valString))

			sb.WriteString("]")
			if i < len(evalMatches)-1 {
				sb.WriteString(", ")
			}
		}
		return sb.String()
	}

	if caps, ok := frame.Meta.Custom.([]NumberValueCapture); ok {
		sb := strings.Builder{}

		for i, c := range caps {
			sb.WriteString("[ ")
			sb.WriteString(fmt.Sprintf("var='%s' ", c.Var))
			sb.WriteString(fmt.Sprintf("labels={%s} ", c.Labels))

			valString := "null"
			if c.Value != nil {
				valString = fmt.Sprintf("%v", *c.Value)
			}

			sb.WriteString(fmt.Sprintf("value=%v ", valString))

			sb.WriteString("]")
			if i < len(caps)-1 {
				sb.WriteString(", ")
			}
		}
		return sb.String()
	}

	return ""
}
