package prometheus_test

import (
	"encoding/json"
	"io/ioutil"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/tsdb/prometheus"
	"github.com/prometheus/common/model"
)

func Benchmark_matrixToDataFrames(b *testing.B) {
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
		if len(frames) != 695 {
			b.Fatal("wrong frames length", len(frames))
		}
	}
}

func loadTestData(path string, res interface{}) error {
	bytes, err := ioutil.ReadFile("./testdata/" + path)
	if err != nil {
		return err
	}
	return json.Unmarshal(bytes, &res)
}
