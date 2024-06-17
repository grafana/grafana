package writer

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/dataplane/sdata/numeric"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

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
		var f float64
		if fp, empty, err := ref.NullableFloat64Value(); !empty && fp != nil {
			f = *fp
		} else if err != nil {
			return nil, fmt.Errorf("unable to get float64 value: %w", err)
		} else {
			return nil, fmt.Errorf("unable to get metric value")
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

type PrometheusWriter struct {
	logger log.Logger
}

func NewPrometheusWriter(
	settings setting.RecordingRuleSettings,
	l log.Logger,
) (*PrometheusWriter, error) {
	return &PrometheusWriter{
		logger: l,
	}, nil
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
