package eval

import (
	"fmt"
	"sort"
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
			valString := "null"
			if m.Value != nil {
				if *m.Value == float64(int64(*m.Value)) {
					valString = fmt.Sprintf("%d", int64(*m.Value))
				} else {
					valString = fmt.Sprintf("%.3f", *m.Value)
				}
			}
			metric := formatMetric(m.Metric, m.Labels)
			sb.WriteString(fmt.Sprintf("%s=%s", metric, valString))

			if i < len(evalMatches)-1 {
				sb.WriteString(", ")
			}
		}
		return sb.String()
	}

	if caps, ok := frame.Meta.Custom.([]NumberValueCapture); ok {
		sb := strings.Builder{}
		for _, c := range caps {
			if c.Var == frame.RefID {
				valString := "null"
				if c.Value != nil {
					if *c.Value == float64(int64(*c.Value)) {
						valString = fmt.Sprintf("%d", int64(*c.Value))
					} else {
						valString = fmt.Sprintf("%.3f", *c.Value)
					}
				}
				metric := formatMetric(c.Metric, c.Labels)
				sb.WriteString(fmt.Sprintf("%s=%s", metric, valString))
			}
		}
		return sb.String()
	}

	return ""
}

// extractValues returns the metric name and value for the result expression in the frame.
// For classic conditions the same metric name can have multiple values due to multiple conditions.
// It returns nil if there are no results in the frame.
func extractValues(frame *data.Frame) map[string]NumberValueCapture {
	if frame == nil {
		return nil
	}
	if frame.Meta == nil || frame.Meta.Custom == nil {
		return nil
	}

	if matches, ok := frame.Meta.Custom.([]classic.EvalMatch); ok {
		// Classic evaluations only have a single match but can contain multiple conditions.
		// Conditions have a strict ordering which we can rely on to distinguish between values,
		// in the case of duplicate names.
		v := make(map[string]NumberValueCapture, len(matches))
		for i, match := range matches {
			// In classic conditions we can use the condition position as a suffix to distinguish between duplicate names.
			// We can guarantee determinism as conditions are ordered and this order is preserved when marshaling.
			metric := formatMetric(match.Metric, match.Labels)
			if _, ok := v[metric]; ok {
				metric += fmt.Sprintf(" [%d]", i)
			}
			v[metric] = NumberValueCapture{
				Var:    frame.RefID,
				Labels: match.Labels,
				Value:  match.Value,
				Metric: match.Metric,
			}
		}
		return v
	}

	if caps, ok := frame.Meta.Custom.([]NumberValueCapture); ok {
		v := make(map[string]NumberValueCapture, len(caps))
		for _, c := range caps {
			if c.Var == frame.RefID {
				metric := formatMetric(c.Metric, c.Labels)
				v[metric] = c
			}
		}
		return v
	}
	return nil
}

// When a metric is "" or "Value", replace it with formatted labels.
// Approximates the frontend auto-naming logic in getFrameDisplayName.
func formatMetric(metric string, labels data.Labels) string {
	if metric == "" || metric == data.TimeSeriesValueFieldName {
		if len(labels) == 1 {
			for _, label := range labels {
				metric = label
			}
		} else if len(labels) > 1 {
			keys := make([]string, len(labels))
			i := 0
			for k := range labels {
				keys[i] = k
				i++
			}
			sort.Strings(keys)

			var labelStrings []string
			for _, k := range keys {
				labelStrings = append(labelStrings, fmt.Sprintf("%s=%s", k, labels[k]))
			}
			metric = fmt.Sprintf("{%s}", strings.Join(labelStrings, ", "))
		}
	}
	return metric
}
