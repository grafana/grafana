package sql

import (
	"fmt"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func TestTranslate(t *testing.T) {
	fieldString := data.NewField("test", nil, []string{"foo", "bardddd"})
	fieldNumber := data.NewField("val", nil, []float64{353343123.12, 333.34})
	frame := data.NewFrame("foo", fieldString, fieldNumber)
	frame.RefID = "foo"

	fieldString2 := data.NewField("test", nil, []string{"foo", "bardddd"})
	fieldNumber2 := data.NewField("val", nil, []float64{100.12, 400.34})
	frame2 := data.NewFrame("bar", fieldString2, fieldNumber2)
	frame2.RefID = "bar"

	frames := data.Frames{frame, frame2}
	s := getSchema(frames, 2)

	// sql, err := Translate("what is the count of foos", s)
	// if err != nil {
	// 	fmt.Println(err.Error())
	// 	t.Fail()
	// 	return
	// }
	// fmt.Println(sql)

	// sql, err = Translate("how many foos", s)
	// if err != nil {
	// 	fmt.Println(err.Error())
	// 	t.Fail()
	// 	return
	// }
	// fmt.Println(sql)

	sql, err := Translate("what is the largest val in foos", s)
	if err != nil {
		fmt.Println(err.Error())
		t.Fail()
		return
	}
	fmt.Println(sql)
}
