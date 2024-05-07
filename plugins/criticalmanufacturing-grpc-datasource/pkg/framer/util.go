package framer

import (
	"strconv"

	proto "cmf/grafana-datamanager-datasource/pkg/proto"

	fields2 "cmf/grafana-datamanager-datasource/pkg/framer/fields"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func convertToDataField(fld *proto.Frame_Field) *data.Field {
	newField := data.NewField(fld.Name, nil, convertValues(fld))

	return newField
}

func convertValues(fld *proto.Frame_Field) interface{} {
	var doubleArray []float64
	if fld.FieldType == proto.Frame_Field_NUMBER {

		for i := 0; i < len(fld.Values); i++ {
			const bitSize = 64 // Don't think about it to much. It's just 64 bits.
			floatNum, _ := strconv.ParseFloat(fld.Values[i], bitSize)
			doubleArray = append(doubleArray, floatNum)
		}
		return doubleArray
	} else {
		return fld.Values
	}
}

type framesResponse interface {
	GetFrames() []*proto.Frame
}

func convertToDataFrames(response framesResponse) data.Frames {
	if response == nil {
		return data.Frames{}
	}

	var res data.Frames
	frames := response.GetFrames()

	for i := range frames {
		metricFrame := frames[i]

		timeField := fields2.TimeField(len(metricFrame.Timestamps))
		for idx := range metricFrame.Timestamps {
			timeField.Set(idx, metricFrame.Timestamps[idx].AsTime())
		}

		var timeFieldLen int = timeField.Len()
		var fields []*data.Field
		var timeColumnAlreadyAdded bool = false

		for idx := range metricFrame.Fields {
			fld := metricFrame.Fields[idx]
			dataField := convertToDataField(fld)

			var dataFieldLen int = dataField.Len()

			if dataFieldLen == timeFieldLen && !timeColumnAlreadyAdded {
				fields = data.Fields{
					timeField,
				}
				timeColumnAlreadyAdded = true
			}

			fields = append(fields, dataField)
		}

		var frameName string

		if metricFrame.Fields == nil {
			frameName = "EmptyFrame"
		} else {
			frameName = metricFrame.Fields[0].Name
		}

		frame := &data.Frame{
			Name:   frameName,
			Fields: fields,
		}
		res = append(res, frame)
	}

	return res
}
