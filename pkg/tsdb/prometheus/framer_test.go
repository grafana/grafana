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
	if err := loadTestData("matrix_range_bench.json", &m); err != nil {
		b.Fatal("failed to load test data", err)
	}
	for i := 0; i < b.N; i++ {
		frames := make([]*data.Frame, 0)
		frames = prometheus.MatrixToDataFrames(m, query, frames)
		if len(frames) != 1 {
			b.Fatal("wrong frame count", len(frames))
		}
		if frames[0].Rows() != 418 {
			b.Fatal("wrong row count", frames[0].Rows())
		}
	}
}

func TestMatrixToDataFrames(t *testing.T) {
	t.Run("matrix_range.json golden response", func(t *testing.T) {
		var m model.Matrix
		err := loadTestData("matrix_range_golden.json", &m)
		require.NoError(t, err)
		require.Equal(t, 3, m.Len())

		query := &prometheus.PrometheusQuery{
			LegendFormat: "",
		}
		frames := make(data.Frames, 0)
		frames = prometheus.MatrixToDataFrames(m, query, frames)
		res := &backend.DataResponse{Frames: frames}

		err = experimental.CheckGoldenDataResponse("./testdata/matrix_range_golden.txt", res, false)
		require.NoError(t, err)
	})
}

func BenchmarkVectorToDataFrames(b *testing.B) {
	query := &prometheus.PrometheusQuery{
		LegendFormat: "",
	}
	var m model.Vector
	if err := loadTestData("vector.json", &m); err != nil {
		b.Fatal("failed to load test data", err)
	}
	for i := 0; i < b.N; i++ {
		frames := make([]*data.Frame, 0)
		frames = prometheus.VectorToDataFrames(m, query, frames)
		if len(frames) != 1 {
			b.Fatal("wrong frame count", len(frames))
		}
		if frames[0].Rows() != 1 {
			b.Fatal("wrong row count", frames[0].Rows())
		}
	}
}

func TestVectorToDataFrames(t *testing.T) {
	t.Run("vector.json golden response", func(t *testing.T) {
		var m model.Vector
		err := loadTestData("vector.json", &m)
		require.NoError(t, err)
		require.Equal(t, 6, m.Len())

		query := &prometheus.PrometheusQuery{
			LegendFormat: "",
		}
		frames := make(data.Frames, 0)
		frames = prometheus.VectorToDataFrames(m, query, frames)
		res := &backend.DataResponse{Frames: frames}

		err = experimental.CheckGoldenDataResponse("./testdata/vector.txt", res, false)
		require.NoError(t, err)
	})
}

func loadTestData(path string, res interface{}) error {
	// Ignore gosec warning G304 since it's a test
	// nolint:gosec
	bytes, err := ioutil.ReadFile("./testdata/" + path)
	if err != nil {
		return err
	}
	return json.Unmarshal(bytes, &res)
}
