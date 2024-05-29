package writer

import (
	"context"
	"math"
	"time"

	"github.com/grafana/dataplane/sdata/numeric"
	"github.com/grafana/grafana/pkg/infra/log"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type PrometheusWriter struct {
	logger log.Logger
}

// Metric represents a Prometheus time series metric.
type Metric struct {
	T int64
	V float64
}

// Point is a logical representation of a single point in time for a Prometheus time series.
type Point struct {
	Name   string
	Labels map[string]string
	Metric Metric
}

func NewPrometheusWriter(l log.Logger) *PrometheusWriter {
	return &PrometheusWriter{
		logger: l,
	}
}

// Write writes the given frames to the Prometheus remote write endpoint.
// TODO: stub implementation, does not make any remote write calls.
func (w PrometheusWriter) Write(ctx context.Context, name string, t time.Time, frames data.Frames, extraLabels map[string]string) error {
	l := w.logger.FromContext(ctx)

	points, err := PointsFromFrames(name, t, frames, extraLabels)
	if err != nil {
		return err
	}

	// TODO: placeholder for actual remote write call
	l.Debug("writing points", "points", points)
	return nil
}

func PointsFromFrames(name string, t time.Time, frames data.Frames, extraLabels map[string]string) ([]Point, error) {
	cr, err := numeric.CollectionReaderFromFrames(frames)
	if err != nil {
		return nil, err
	}

	col, err := cr.GetCollection(false)
	if err != nil {
		return nil, err
	}

	points := make([]Point, 0, len(col.Refs))
	for _, ref := range col.Refs {
		f := math.NaN()
		if fp, empty, err := ref.NullableFloat64Value(); err != nil {
			return nil, err
		} else if !empty && fp != nil {
			f = *fp
		}
		metric := Metric{
			T: t.Unix(),
			V: f,
		}

		labels := ref.GetLabels().Copy()
		if labels == nil {
			labels = data.Labels{}
		}
		delete(labels, "__name__")
		for k, v := range extraLabels {
			labels[k] = v
		}

		points = append(points, Point{
			Name:   name,
			Labels: labels,
			Metric: metric,
		})
	}

	return points, nil
}
