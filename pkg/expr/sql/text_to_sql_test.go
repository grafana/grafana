package sql

import (
	"fmt"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func TestSchema(t *testing.T) {
	fieldString := data.NewField("test", nil, []string{"foo", "bardddd"})
	fieldNumber := data.NewField("val", nil, []float64{353343123.12, 333.34})
	frame := data.NewFrame("foo", fieldString, fieldNumber)
	frame.RefID = "foo"

	fieldString2 := data.NewField("test", nil, []string{"foo", "bardddd"})
	fieldNumber2 := data.NewField("val", nil, []float64{353343123.12, 333.34})
	frame2 := data.NewFrame("bar", fieldString2, fieldNumber2)
	frame2.RefID = "bar"

	frames := data.Frames{frame, frame2}
	s := getSchema(frames, 2)
	fmt.Println(s)
}
