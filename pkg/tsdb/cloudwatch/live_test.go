package cloudwatch

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
)

func TestGroupResponseFrame(t *testing.T) {
	t.Run("Doesn't group results without time field", func(t *testing.T) {
		frame := data.NewFrameOfFieldTypes("test", 0, data.FieldTypeString, data.FieldTypeInt32)
		frame.AppendRow("val1", int32(10))
		frame.AppendRow("val2", int32(20))
		frame.AppendRow("val3", int32(30))

		groupedFrame, err := groupResponseFrame(frame, []string{"something"})
		require.NoError(t, err)
		require.Equal(t, 3, groupedFrame[0].Rows())
		require.Equal(t, []interface{}{"val1", "val2", "val3"}, asArray(groupedFrame[0].Fields[0]))
		require.Equal(t, []interface{}{int32(10), int32(20), int32(30)}, asArray(groupedFrame[0].Fields[1]))
	})
}

func asArray(field *data.Field) []interface{} {
	var vals []interface{}
	for i := 0; i < field.Len(); i++ {
		vals = append(vals, field.At(i))
	}
	return vals
}
