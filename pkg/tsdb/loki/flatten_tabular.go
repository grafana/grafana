package loki

import (
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// flattenLogsToTabular merges Loki log frames into one tabular frame with columns
// timestamp, line, and stream label columns (for Grafana SQL / schemads).
func flattenLogsToTabular(frames data.Frames, logsDataplane bool, logger log.Logger) data.Frames {
	if len(frames) == 0 {
		return frames
	}

	type row struct {
		ts     time.Time
		line   string
		labels map[string]string
	}

	var rows []row
	labelKeysSet := map[string]struct{}{}
	var executedQuery string

	for _, frame := range frames {
		if frame.Meta != nil && frame.Meta.ExecutedQueryString != "" {
			executedQuery = frame.Meta.ExecutedQueryString
		}

		if len(frame.Fields) < 2 {
			logger.Warn("loki: skipping flatten, frame has fewer than 2 fields")
			continue
		}
		// Metric frame: leave unchanged by appending as single-frame passthrough path is handled per-frame.
		if frame.Fields[1].Type() == data.FieldTypeFloat64 {
			// Return mixed frames unmodified if we hit metrics — Grafana SQL path should only emit logs.
			return frames
		}

		timeField, lineField, labelsField, ok := extractLogFields(frame, logsDataplane)
		if !ok || timeField == nil || lineField == nil || labelsField == nil {
			logger.Warn("loki: skipping frame, could not extract log fields", "logsDataplane", logsDataplane)
			continue
		}

		n := timeField.Len()
		for i := 0; i < n; i++ {
			tv, ok := timeField.At(i).(time.Time)
			if !ok {
				logger.Warn("loki: skipping log row, time value is not time.Time", "row", i)
				continue
			}
			line, ok := lineField.At(i).(string)
			if !ok {
				logger.Warn("loki: skipping log row, line value is not string", "row", i)
				continue
			}
			lmap, err := labelsAt(labelsField, i)
			if err != nil {
				logger.Warn("loki: skipping log row, labels field invalid", "row", i, "error", err)
				continue
			}
			for k := range lmap {
				labelKeysSet[k] = struct{}{}
			}
			rows = append(rows, row{ts: tv, line: line, labels: lmap})
		}
	}

	if len(rows) == 0 {
		return frames
	}

	labelKeys := make([]string, 0, len(labelKeysSet))
	for k := range labelKeysSet {
		labelKeys = append(labelKeys, k)
	}
	sort.Strings(labelKeys)

	sort.SliceStable(rows, func(i, j int) bool {
		if rows[i].ts.Equal(rows[j].ts) {
			return rows[i].line < rows[j].line
		}
		return rows[i].ts.Before(rows[j].ts)
	})

	times := make([]time.Time, len(rows))
	lines := make([]string, len(rows))
	labelCols := make(map[string][]*string)
	for _, k := range labelKeys {
		labelCols[k] = make([]*string, len(rows))
	}

	for i, r := range rows {
		times[i] = r.ts
		lines[i] = r.line
		for _, k := range labelKeys {
			if v, ok := r.labels[k]; ok {
				vv := v
				labelCols[k][i] = &vv
			}
		}
	}

	outFields := make([]*data.Field, 0, 2+len(labelKeys))
	outFields = append(outFields,
		data.NewField("timestamp", nil, times),
		data.NewField("line", nil, lines),
	)
	for _, k := range labelKeys {
		outFields = append(outFields, data.NewField(k, nil, labelCols[k]))
	}

	out := data.NewFrame("", outFields...)
	if executedQuery != "" {
		out.Meta = &data.FrameMeta{
			ExecutedQueryString: executedQuery,
		}
	}

	return data.Frames{out}
}

func extractLogFields(frame *data.Frame, logsDataplane bool) (timeField *data.Field, lineField *data.Field, labelsField *data.Field, ok bool) {
	fields := frame.Fields
	if logsDataplane {
		for _, f := range fields {
			switch f.Name {
			case "timestamp":
				if f.Type() == data.FieldTypeTime || f.Type() == data.FieldTypeNullableTime {
					timeField = f
				}
			case "body":
				if f.Type() == data.FieldTypeString {
					lineField = f
				}
			case "labels":
				if f.Type() == data.FieldTypeJSON {
					labelsField = f
				}
			}
		}
		return timeField, lineField, labelsField, timeField != nil && lineField != nil && labelsField != nil
	}

	// Legacy layout after adjustLegacyLogsFrame: labels, time, line, tsNs, ...
	if len(fields) >= 4 && fields[0].Type() == data.FieldTypeJSON &&
		(fields[1].Type() == data.FieldTypeTime || fields[1].Type() == data.FieldTypeNullableTime) &&
		fields[2].Type() == data.FieldTypeString {
		return fields[1], fields[2], fields[0], true
	}

	return nil, nil, nil, false
}

func labelsAt(f *data.Field, idx int) (map[string]string, error) {
	raw, ok := f.At(idx).(json.RawMessage)
	if !ok {
		return nil, fmt.Errorf("labels field is not JSON")
	}
	var m map[string]interface{}
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil, err
	}
	out := make(map[string]string, len(m))
	for k, v := range m {
		s, err := labelJSONValueToString(v)
		if err != nil {
			return nil, fmt.Errorf("label %q: %w", k, err)
		}
		out[k] = s
	}
	return out, nil
}

// labelJSONValueToString formats a single JSON label value for tabular (string) columns.
func labelJSONValueToString(v interface{}) (string, error) {
	if v == nil {
		return "", nil
	}
	switch t := v.(type) {
	case string:
		return t, nil
	case bool:
		return strconv.FormatBool(t), nil
	case float64:
		return strconv.FormatFloat(t, 'f', -1, 64), nil
	case json.Number:
		return t.String(), nil
	default:
		b, err := json.Marshal(t)
		if err != nil {
			return "", err
		}
		return string(b), nil
	}
}
