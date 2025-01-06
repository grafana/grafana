package expr

import (
	"testing"

	"github.com/davecgh/go-spew/spew"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func TestConvertNumericWideToLong(t *testing.T) {
	input := data.Frames{
		data.NewFrame("test",
			data.NewField("count", data.Labels{"city": "MIA"}, []float64{5}),
			data.NewField("moreCount", data.Labels{"city": "LGA"}, []float64{7}),
		),
	}
	output, err := convertNumericWideToNumericLong(input)
	spew.Dump(err)
	spew.Dump(output)
}
