package loganalytics

import (
	"fmt"
	"strconv"
	"time"

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

func ConvertTime(timeStamp string) (time.Time, error) {
	// Convert the timestamp string to an int64
	timestampInt, err := strconv.ParseInt(timeStamp, 10, 64)
	if err != nil {
		// Handle error
		return time.Time{}, err
	}

	// Convert the Unix timestamp (in milliseconds) to a time.Time
	convTimeStamp := time.Unix(0, timestampInt*int64(time.Millisecond))

	return convTimeStamp, nil
}

func GetDataVolumeRawQuery(table string) string {
	return fmt.Sprintf("Usage \n| where DataType == \"%s\"\n| where IsBillable == true\n| summarize BillableDataGB = round(sum(Quantity) / 1000, 3)", table)
}
