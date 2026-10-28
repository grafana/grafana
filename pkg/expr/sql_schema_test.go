package expr

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/stretchr/testify/require"
)

func TestGetSQLSchemasRepeatedColumnNames(t *testing.T) {
	dsFrame := data.NewFrame("",
		data.NewField("host", nil, []string{"a"}),
		data.NewField("Host", nil, []string{"b"}),
		data.NewField("host", nil, []string{"c"}),
	)
	resp := map[string]backend.DataResponse{
		"A": {Frames: data.Frames{dsFrame}},
	}
	queries := []Query{
		{
			RefID: "A",
			DataSource: &datasources.DataSource{
				OrgID: 1,
				UID:   "test",
				Type:  "test",
			},
			JSON:      json.RawMessage(`{ "datasource": { "uid": "1" }, "intervalMs": 1000, "maxDataPoints": 1000 }`),
			TimeRange: AbsoluteTimeRange{From: time.Time{}, To: time.Time{}},
		},
	}

	s, req := newMockQueryService(resp, queries)
	schemas, err := s.GetSQLSchemas(t.Context(), *req)
	require.NoError(t, err)

	info := schemas["A"]
	require.Empty(t, info.Error)
	names := make([]string, 0, len(info.Columns))
	for _, col := range info.Columns {
		names = append(names, col.Name)
	}
	require.Equal(t, []string{"host", "Host_2", "host_3"}, names)
}
