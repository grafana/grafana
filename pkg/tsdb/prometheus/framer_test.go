package prometheus_test

import (
	"encoding/json"
	"io/ioutil"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/grafana/grafana/pkg/tsdb/prometheus"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
)

func BenchmarkMatrixToDataFrames(b *testing.B) {
	query := &prometheus.PrometheusQuery{
		LegendFormat: "",
	}
	var m model.Matrix
	if err := loadTestData("matrix_range.json", &m); err != nil {
		b.Fatal("failed to load test data", err)
	}
	for i := 0; i < b.N; i++ {
		frames := make([]*data.Frame, 0)
		frames = prometheus.MatrixToDataFrames(m, query, frames)
		if len(frames) != 1 {
			b.Fatal("wrong frame count", len(frames))
		}
	}
}

func TestMatrixToDataFrames(t *testing.T) {
	t.Run("test", func(t *testing.T) {
		var m model.Matrix
		err := loadTestData("matrix_range.json", &m)
		require.NoError(t, err)

		query := &prometheus.PrometheusQuery{
			LegendFormat: "",
		}
		frames := make(data.Frames, 0)
		frames = prometheus.MatrixToDataFrames(m, query, frames)
		res := &backend.DataResponse{Frames: frames}

		err = experimental.CheckGoldenDataResponse("./testdata/matrix_range.txt", res, false)
		require.NoError(t, err)
	})
}

func loadTestData(path string, res interface{}) error {
	bytes, err := ioutil.ReadFile("./testdata/" + path)
	if err != nil {
		return err
	}
	return json.Unmarshal(bytes, &res)
}
