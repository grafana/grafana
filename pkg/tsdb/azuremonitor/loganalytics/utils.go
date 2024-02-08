package loganalytics

import (
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func AddCustomDataLink(frame data.Frame, dataLink data.DataLink) data.Frame {
	for i := range frame.Fields {
		if frame.Fields[i].Config == nil {
			frame.Fields[i].Config = &data.FieldConfig{}
		}

		frame.Fields[i].Config.Links = append(frame.Fields[i].Config.Links, dataLink)
	}
	return frame
}

func AddConfigLinks(frame data.Frame, dl string, title *string) data.Frame {
	linkTitle := "View in Azure Portal"
	if title != nil {
		linkTitle = *title
	}

	deepLink := data.DataLink{
		Title:       linkTitle,
		TargetBlank: true,
		URL:         dl,
	}

	frame = AddCustomDataLink(frame, deepLink)

	return frame
}
