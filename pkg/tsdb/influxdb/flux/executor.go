package flux

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/influxdata/influxdb-client-go/api"
)

// ExecuteQuery runs a flux query using the QueryModel to interpolate the query and the runner to execute it.
// maxSeries somehow limits the response.
func ExecuteQuery(ctx context.Context, query QueryModel, runner queryRunner, maxSeries int) (dr backend.DataResponse) {
	dr = backend.DataResponse{}

	flux, err := Interpolate(query)
	if err != nil {
		dr.Error = err
		return
	}

	glog.Debug("Flux", "interpolated query", flux)

	tables, err := runner.runQuery(ctx, flux)
	if err != nil {
		dr.Error = err
		metaFrame := data.NewFrame("meta for error")
		metaFrame.Meta = &data.FrameMeta{
			ExecutedQueryString: flux,
		}
		dr.Frames = append(dr.Frames, metaFrame)
		return
	}

	dr = readDataFrames(tables, int(float64(query.MaxDataPoints)*1.5), maxSeries)

	for _, frame := range dr.Frames {
		if frame.Meta == nil {
			frame.Meta = &data.FrameMeta{}
		}
		frame.Meta.ExecutedQueryString = flux
	}

	return dr
}

func readDataFrames(result *api.QueryTableResult, maxPoints int, maxSeries int) (dr backend.DataResponse) {
	dr = backend.DataResponse{}

	builder := &FrameBuilder{
		maxPoints: maxPoints,
		maxSeries: maxSeries,
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
			dr.Error = fmt.Errorf("Invalid state")
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

	// Attach any errors (may be null)
	dr.Error = result.Err()
	return dr
}
