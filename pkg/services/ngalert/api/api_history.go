package api

import (
	"errors"
	"fmt"
	"math"
	"math/rand"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/setting"
)

const MIN_HISTORY_DURATION float64 = 60 * 60 // 1 hour

type ForkedHistoryApi struct {
	log log.Logger
	cfg *setting.UnifiedAlertingHistorySettings
	ac  accesscontrol.AccessControl
}

func (f *ForkedHistoryApi) forkRouteGetAlertStateHistory(ctx *models.ReqContext, uIDParam string) response.Response {
	// History must be enabled for this API to be available.
	if !f.cfg.DemoEnabled {
		return response.Error(404, "Alert State History is not enabled.", nil)
	}

	// Validate parameters.
	// TODO: would be nice to codegen these query params as well.
	start := ctx.QueryFloat64("start")
	end := ctx.QueryFloat64("end")
	limit := ctx.QueryInt("limit")
	if start == 0 || end == 0 {
		return response.Error(400, "Start and End query parameters are required.", nil)
	}

	if end-start < MIN_HISTORY_DURATION {
		return response.Error(400, fmt.Sprintf("end - start must be at least %v. Received %v - %v = %v ", MIN_HISTORY_DURATION, start, end, end-start), nil)
	}

	resp := definitions.GetAlertStateHistoryResponse{}
	resp.Body.RuleUID = uIDParam
	resp.Body.Limit = limit

	// For now we only return demo data.
	resp.Body.Message = "Test data for the Grafana Alert State History API."
	frames, err := historyDemoData(uIDParam, start, end, limit)
	if err != nil {
		// TODO: What kind of error? Just 5xx for now. Real implementations will switch on the error type.
		return response.Error(500, "Internal error generating frames", err)
	}

	resp.Body.InstanceData = &backend.DataResponse{
		Frames: frames,
		Error:  nil,
	}

	// Right now we return a frame per-series. This may not always be the case -
	// one might need to count all the non-time columns in all the frames to be
	// correct.
	resp.Body.Found = len(resp.Body.InstanceData.Frames)

	return response.JSON(200, resp)
}

func historyDemoData(ruleUID string, start, end float64, limit int) ([]*data.Frame, error) {
	if limit < 5 {
		return nil, errors.New("Test Data always returns 5 series")
	}

	// TODO: Maybe include a name in each frame?
	var frames []*data.Frame
	for i := 0; i < 5; i++ {
		labels, _ := data.LabelsFromString(fmt.Sprintf("{rule=%v, some-label=%v}", ruleUID, i))
		frames = append(frames, &data.Frame{
			Fields: []*data.Field{
				data.NewField("time", nil, []time.Time{}),
				data.NewField("state", labels, []string{}),
			},
		})
	}

	fmt.Println(frames[0].Fields)

	var i int
	for t := start; t <= end; t += 63.0 {
		sec, nsec := func(seconds float64) (int64, int64) {
			sec := int64(seconds) // Rounds toward 0, per the language spec
			nsec := int64((seconds - math.Floor(seconds)) * 1e9)
			return sec, nsec
		}(t)

		// The first series is always alerting
		frames[0].Fields[0].Append(time.Unix(sec, nsec))
		frames[0].Fields[1].Append(chooseFrom("Alerting"))

		// The second series toggles between alerting and pending randomly.
		frames[1].Fields[0].Append(time.Unix(sec, nsec))
		frames[1].Fields[1].Append(chooseFrom("Alerting", "Pending"))

		// The third series toggles between alerting and "OK" randomly.
		frames[2].Fields[0].Append(time.Unix(sec, nsec))
		frames[2].Fields[1].Append(chooseFrom("Alerting", "OK"))

		// The fourth series toggles between OK and OK (No Data) randomly
		frames[3].Fields[0].Append(time.Unix(sec, nsec))
		frames[3].Fields[1].Append(chooseFrom("OK", "OK (No Data)"))

		// The fifth series toggles between Alerting and Alerting (Error), and OK randomly.
		frames[4].Fields[0].Append(time.Unix(sec, nsec))
		frames[4].Fields[1].Append(chooseFrom("Alerting", "Alerting (Error)", "OK"))

		// The series are in "long" format in separate frames. TODO: can the panel type handle long format? If no, why not?
		i++
	}

	return frames, nil
}

func chooseFrom(v ...string) string {
	r := rand.Float64()
	interval := 1.0 / float64(len(v))

	for i := 0; i < len(v); i++ {
		if r < float64(i+1)*interval {
			return v[i]
		}
	}

	return v[len(v)-1]
}
