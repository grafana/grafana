package expr

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/dataplane/sdata"
	"github.com/grafana/dataplane/sdata/numeric"
	"github.com/grafana/dataplane/sdata/reader"
	"github.com/grafana/dataplane/sdata/timeseries"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"go.opentelemetry.io/otel/attribute"
)

func shouldUseDataplane(frames data.Frames, logger log.Logger, disable bool) (dt data.FrameType, b bool, e error) {
	if disable {
		return
	}
	dt = data.FrameTypeUnknown
	if len(frames) == 0 {
		return data.FrameTypeUnknown, true, nil
	}

	firstFrame := frames[0]
	if firstFrame == nil {
		return
	}

	if firstFrame.Meta == nil {
		return
	}

	if firstFrame.Meta.Type == "" {
		return
	}

	if firstFrame.Meta.TypeVersion.IsZero() {
		return
	}

	dt, err := reader.CanReadBasedOnMeta(frames)
	if err != nil {
		var vw *sdata.VersionWarning
		if errors.As(err, &vw) {
			logger.Warn("Attempting to read mismatched version dataplane data", "error", err, "datatype", dt)
			return dt, true, nil
		}
		// TODO: Remove as more confidence is gained in dataplane data handling and return the error
		logger.Warn("Dataplane data detected but falling back to old processing due to error",
			"error", err)

		return dt, false, err
	}
	return dt, true, nil
}

func handleDataplaneFrames(ctx context.Context, tracer tracing.Tracer, features featuremgmt.FeatureToggles, t data.FrameType, frames data.Frames) (mathexp.Results, error) {
	_, span := tracer.Start(ctx, "SSE.HandleDataPlaneData")
	defer span.End()
	span.SetAttributes(attribute.String("dataplane.type", string(t)))

	switch t.Kind() {
	case data.KindUnknown:
		return mathexp.Results{Values: mathexp.Values{mathexp.NoData{}.New()}}, nil
	case data.KindTimeSeries:
		return handleDataplaneTimeseries(frames)
	case data.KindNumeric:
		sortMetrics := !features.IsEnabled(ctx, featuremgmt.FlagDisableNumericMetricsSortingInExpressions)
		return handleDataplaneNumeric(frames, sortMetrics)
	default:
		return mathexp.Results{}, fmt.Errorf("kind %s (type %s) not supported by server side expressions", t.Kind(), t)
	}
}

func handleDataplaneTimeseries(frames data.Frames) (mathexp.Results, error) {
	dps, err := timeseries.CollectionReaderFromFrames(frames)
	if err != nil {
		return mathexp.Results{}, err
	}
	sc, err := dps.GetCollection(false)
	if err != nil {
		return mathexp.Results{}, err
	}
	if sc.NoData() {
		noData := mathexp.NoData{}.New()
		if len(dps.Frames()) == 1 {
			// If single frame form of nodata, copy the frame to pass through metadata
			noData.Frame = dps.Frames()[0]
		}
		return mathexp.Results{Values: mathexp.Values{noData}}, nil
	}
	res := mathexp.Results{}
	res.Values = make([]mathexp.Value, 0, len(sc.Refs))
	for _, s := range sc.Refs {
		newSeries, err := mathexp.NewSeriesFromRef(sc.RefID, s)
		if err != nil {
			return res, err
		}
		res.Values = append(res.Values, newSeries)
	}

	return res, nil
}

func handleDataplaneNumeric(frames data.Frames, sortMetrics bool) (mathexp.Results, error) {
	dn, err := numeric.CollectionReaderFromFrames(frames)
	if err != nil {
		return mathexp.Results{}, err
	}
	nc, err := dn.GetCollection(false)
	if err != nil {
		return mathexp.Results{}, err
	}
	if nc.NoData() {
		noData := mathexp.NoData{}.New()
		if len(dn.Frames()) == 1 {
			// If single frame form of nodata, copy the frame to pass through metadata
			noData.Frame = dn.Frames()[0]
		}
		return mathexp.Results{Values: mathexp.Values{noData}}, nil
	}
	if sortMetrics {
		numeric.SortNumericMetricRef(nc.Refs)
	}
	res := mathexp.Results{}
	res.Values = make([]mathexp.Value, 0, len(nc.Refs))
	for _, n := range nc.Refs {
		newNum, err := mathexp.NumberFromRef(nc.RefID, n)
		if err != nil {
			return res, err
		}
		res.Values = append(res.Values, newNum)
	}

	return res, nil
}
