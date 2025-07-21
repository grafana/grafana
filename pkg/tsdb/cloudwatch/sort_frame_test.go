package cloudwatch

import (
	"sort"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/stretchr/testify/assert"
)

func TestFrameSort(t *testing.T) {
	t.Run("sort simple frame", func(t *testing.T) {
		timeA, _ := time.Parse("2006-01-02 15:04:05.000", "2020-03-02 17:04:05.000")
		timeB, _ := time.Parse("2006-01-02 15:04:05.000", "2020-03-02 16:04:05.000")
		timeC, _ := time.Parse("2006-01-02 15:04:05.000", "2020-03-02 15:04:05.000")
		timeVals := []*time.Time{
			&timeA, &timeB, &timeC,
		}
		timeField := data.NewField("@timestamp", nil, timeVals)

		stringField := data.NewField("line", nil, []*string{
			aws.String("test message 1"),
			aws.String("test message 2"),
			aws.String("test message 3"),
		})

		numberField := data.NewField("nums", nil, []*float64{
			aws.Float64(20.0),
			aws.Float64(50.0),
			aws.Float64(17.0),
		})

		expectedDataframe := &data.Frame{
			Name: "CloudWatchLogsResponse",
			Fields: []*data.Field{
				timeField,
				stringField,
				numberField,
			},
		}

		sort.Sort(ByTime(*expectedDataframe))

		for i := 1; i < timeField.Len(); i++ {
			assert.True(t, timeField.At(i).(*time.Time).After(*(timeField.At(i - 1).(*time.Time))))
		}

		assert.Equal(t, *stringField.At(0).(*string), "test message 3")
		assert.Equal(t, *stringField.At(1).(*string), "test message 2")
		assert.Equal(t, *stringField.At(2).(*string), "test message 1")

		assert.Equal(t, *numberField.At(0).(*float64), 17.0)
		assert.Equal(t, *numberField.At(1).(*float64), 50.0)
		assert.Equal(t, *numberField.At(2).(*float64), 20.0)
	})

	t.Run("sort with nil", func(t *testing.T) {
		timeA, _ := time.Parse("2006-01-02 15:04:05.000", "2020-03-02 17:04:05.000")
		timeB, _ := time.Parse("2006-01-02 15:04:05.000", "2020-03-02 16:04:05.000")
		timeVals := []*time.Time{
			&timeA, &timeB, nil,
		}
		timeField := data.NewField("@timestamp", nil, timeVals)

		stringField := data.NewField("line", nil, []*string{
			aws.String("test message 1"),
			aws.String("test message 2"),
			aws.String("test message 3"),
		})

		frame := &data.Frame{
			Name: "CloudWatchLogsResponse",
			Fields: []*data.Field{
				timeField,
				stringField,
			},
		}

		sort.Sort(ByTime(*frame))

		assert.Equal(t, *stringField.At(0).(*string), "test message 2")
		assert.Equal(t, *stringField.At(1).(*string), "test message 1")
		assert.Equal(t, *stringField.At(2).(*string), "test message 3")
	})
}
