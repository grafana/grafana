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

	evalMatches, ok := frame.Meta.Custom.([]classic.EvalMatch)
	if !ok {
		return
	}

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
