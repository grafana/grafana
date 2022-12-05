package eval

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/services/expr/classic"
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
			sb.WriteString(fmt.Sprintf("var='%s%v' ", frame.RefID, i))
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

// extractValues returns the RefID and value for all classic conditions, reduce, and math expressions in the frame.
// For classic conditions the same refID can have multiple values due to multiple conditions, for them we use the index of
// the condition in addition to the refID to distinguish between different values.
// It returns nil if there are no results in the frame.
func extractValues(frame *data.Frame) map[string]NumberValueCapture {
	if frame == nil {
		return nil
	}
	if frame.Meta == nil || frame.Meta.Custom == nil {
		return nil
	}

	if matches, ok := frame.Meta.Custom.([]classic.EvalMatch); ok {
		// Classic evaluations only have a single match but it can contain multiple conditions.
		// Conditions have a strict ordering which we can rely on to distinguish between values.
		v := make(map[string]NumberValueCapture, len(matches))
		for i, match := range matches {
			// In classic conditions we use refID and the condition position as a way to distinguish between values.
			// We can guarantee determinism as conditions are ordered and this order is preserved when marshaling.
			refID := fmt.Sprintf("%s%d", frame.RefID, i)
			v[refID] = NumberValueCapture{
				Var:    frame.RefID,
				Labels: match.Labels,
				Value:  match.Value,
			}
		}
		return v
	}

	if caps, ok := frame.Meta.Custom.([]NumberValueCapture); ok {
		v := make(map[string]NumberValueCapture, len(caps))
		for _, c := range caps {
			v[c.Var] = c
		}
		return v
	}
	return nil
}
