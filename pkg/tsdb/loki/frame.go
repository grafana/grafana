package loki

import (
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// TEMPORARY: will remove when this is returned directly from loki
type logsFrame struct {
	labels *data.Field
	time   *data.Field
	line   *data.Field
	frame  *data.Frame
}

// TEMPORARY: will remove when this is returned directly from loki
func newLogsFrame(size int) logsFrame {
	wrap := logsFrame{
		labels: data.NewFieldFromFieldType(data.FieldTypeString, size),
		time:   data.NewFieldFromFieldType(data.FieldTypeTime, size),
		line:   data.NewFieldFromFieldType(data.FieldTypeString, size),
	}

	wrap.labels.Name = "Labels"
	wrap.time.Name = "Time"
	wrap.line.Name = "Line"

	wrap.frame = data.NewFrame("", wrap.labels, wrap.time, wrap.line)
	wrap.frame.SetMeta(&data.FrameMeta{
		// TODO -- types
	})
	return wrap
}
