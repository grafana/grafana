package flux

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/influxdata/influxdb-client-go/v2/api"
)

const maxPointsEnforceFactor float64 = 10

// executeQuery runs a flux query using the queryModel to interpolate the query and the runner to execute it.
// maxSeries somehow limits the response.
func executeQuery(ctx context.Context, query queryModel, runner queryRunner, maxSeries int) (dr backend.DataResponse) {
	dr = backend.DataResponse{}

	flux, err := interpolate(query)
	if err != nil {
		dr.Error = err
		return
	}

	glog.Debug("Executing Flux query", "flux", flux)

	tables, err := runner.runQuery(ctx, flux)
	if err != nil {
		glog.Warn("Flux query failed", "err", err, "query", flux)
		dr.Error = err
	} else {
		// we only enforce a larger number than maxDataPoints
		maxPointsEnforced := int(float64(query.MaxDataPoints) * maxPointsEnforceFactor)
		// at the point where the check for exceeding maxPoints happens
		// we do not have enough information to create a good error-message,
		// so we create a function here that encapsulates the making
		// of that error-message
		makeMaxPointsExceededErrorMessage := func() string {
			text := fmt.Sprintf("results are truncated, max points tolerance exceeded (max: %d, enforced: %d)", query.MaxDataPoints, maxPointsEnforced)
			// we recommend to the user to use AggregateWindow(), but only if it is not already used
			if !strings.Contains(query.RawQuery, "aggregateWindow(") {
				text += ", try using the aggregateWindow() function in your query to reduce the number of points returned"
			}
			return text
		}
		dr = readDataFrames(tables, maxPointsEnforced, makeMaxPointsExceededErrorMessage, maxSeries)
	}

	// Make sure there is at least one frame
	if len(dr.Frames) == 0 {
		dr.Frames = append(dr.Frames, data.NewFrame(""))
	}
	firstFrame := dr.Frames[0]
	if firstFrame.Meta == nil {
		firstFrame.SetMeta(&data.FrameMeta{})
	}
	firstFrame.Meta.ExecutedQueryString = flux
	return dr
}

func readDataFrames(result *api.QueryTableResult, maxPoints int, makeMaxPointsExceededErrorMessage func() string, maxSeries int) (dr backend.DataResponse) {
	glog.Debug("Reading data frames from query result", "maxPoints", maxPoints, "maxSeries", maxSeries)
	dr = backend.DataResponse{}

	builder := &frameBuilder{
		maxPoints:                         maxPoints,
		makeMaxPointsExceededErrorMessage: makeMaxPointsExceededErrorMessage,
		maxSeries:                         maxSeries,
	}

	for result.Next() {
		// Observe when there is new grouping key producing new table
		if result.TableChanged() {
			if builder.frames != nil {
				for _, frame := range builder.frames {
					dr.Frames = append(dr.Frames, frame)
				}
			}
			err := builder.Init(result.TableMetadata())
			if err != nil {
				dr.Error = err
				return
			}
		}

		if builder.frames == nil {
			dr.Error = fmt.Errorf("invalid state")
			return dr
		}

		err := builder.Append(result.Record())
		if err != nil {
			dr.Error = err
			break
		}
	}

	// Add the inprogress record
	if builder.frames != nil {
		for _, frame := range builder.frames {
			dr.Frames = append(dr.Frames, frame)
		}
	}

	// result.Err() is probably more important then the other errors
	if result.Err() != nil {
		dr.Error = result.Err()
	}
	return dr
}
