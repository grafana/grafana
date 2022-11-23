package models

import (
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type AnnotationEvent struct {
	Title string
	Time  time.Time
	Tags  string
	Text  string
}

type AnnotationEvents []*AnnotationEvent

func (annationEvents AnnotationEvents) Frames(refId string) data.Frames {
	frame := data.NewFrame(refId,
		data.NewField("time", nil, []time.Time{}),
		data.NewField("title", nil, []string{}),
		data.NewField("tags", nil, []string{}),
		data.NewField("text", nil, []string{}),
	)

	for _, a := range annationEvents {
		frame.AppendRow(a.Time, a.Title, a.Tags, a.Text)
	}

	frame.Meta = &data.FrameMeta{
		Custom: map[string]interface{}{
			"rowCount": len(annationEvents),
		},
	}

	return data.Frames{frame}
}
