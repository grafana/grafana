package expr

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"github.com/stretchr/testify/require"
)

func TestConvertBackendRequestToDataRequest(t *testing.T) {
	input1 := backend.DataQuery{
		RefID:         "A",
		QueryType:     "large",
		MaxDataPoints: 42,
		Interval:      time.Millisecond * 10,
		TimeRange: backend.TimeRange{
			From: time.UnixMilli(1753959290000),
			To:   time.UnixMilli(1753959390000),
		},
		JSON: []byte(`{ "field1": "value1" }`),
	}

	result1 := data.DataQuery{
		CommonQueryProperties: data.CommonQueryProperties{
			RefID:         "A",
			QueryType:     "large",
			MaxDataPoints: 42,
			IntervalMS:    10.0,
			TimeRange: &data.TimeRange{
				From: "1753959290000",
				To:   "1753959390000",
			},
		},
	}
	result1.Set("field1", "value1")

	req := backend.QueryDataRequest{
		Queries: []backend.DataQuery{input1},
	}

	expected := data.QueryDataRequest{
		Queries: []data.DataQuery{result1},
	}

	result, err := ConvertBackendRequestToDataRequest(&req)
	require.NoError(t, err)
	require.Equal(t, &expected, result)
}
