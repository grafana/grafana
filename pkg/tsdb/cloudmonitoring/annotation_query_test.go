package cloudmonitoring

import (
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCloudMonitoringExecutor_transformToDataframes(t *testing.T) {
	d, err := loadTestFile("./test-data/2-series-response-no-agg.json")
	require.NoError(t, err)
	require.Len(t, d.TimeSeries, 3)

	res := &tsdb.QueryResult{Meta: simplejson.New(), RefId: "annotationQuery",
		Dataframes: tsdb.NewDecodedDataFrames(data.Frames{
			&data.Frame{
				Name: "title",
				Fields: []*data.Field{
					data.NewField("test", nil, []string{}),
					data.NewField("test", nil, []string{}),
				},
			},
		}),
	}

	transformToDataframes(res, "atitle", "atext", "atag")
	require.NoError(t, err)

	decoded, err := res.Dataframes.Decoded()
	require.Len(t, decoded, 1)
	assert.Equal(t, "atitle", decoded[0].Fields[1].Name)
	assert.Equal(t, "atext", decoded[0].Fields[2].Name)
	assert.Equal(t, "atag", decoded[0].Fields[3].Name)
}
