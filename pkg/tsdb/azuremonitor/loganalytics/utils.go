package loganalytics

import (
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/kinds/dataquery"
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
	linkTitle := "View query in Azure Portal"
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

func ParseResultFormat(queryResultFormat *dataquery.ResultFormat, queryType dataquery.AzureQueryType) dataquery.ResultFormat {
	var resultFormat dataquery.ResultFormat
	if queryResultFormat != nil {
		resultFormat = *queryResultFormat
	}
	if resultFormat == "" {
		if queryType == dataquery.AzureQueryTypeAzureLogAnalytics {
			// Default to logs format for logs queries
			resultFormat = dataquery.ResultFormatLogs
		}
		if queryType == dataquery.AzureQueryTypeAzureTraces {
			// Default to table format for traces queries as many traces may be returned
			resultFormat = dataquery.ResultFormatTable
		}
	}
	return resultFormat
}
