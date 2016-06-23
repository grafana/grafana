package alerting

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting/alertstates"
	. "github.com/smartystreets/goconvey/convey"
)

func TestAlertResultHandler(t *testing.T) {
	Convey("Test result Handler", t, func() {
		resultHandler := ResultHandlerImpl{}
		mockResult := &AlertResult{
			State: alertstates.Ok,
			AlertJob: &AlertJob{
				Rule: &AlertRule{
					Id:    1,
					OrgId: 1,
				},
			},
		}
		mockAlertState := &m.AlertState{}
		bus.ClearBusHandlers()
		bus.AddHandler("test", func(query *m.GetLastAlertStateQuery) error {
			query.Result = mockAlertState
			return nil
		})

		Convey("Should update", func() {

			Convey("when no earlier alert state", func() {
				mockAlertState = nil
				So(resultHandler.shouldUpdateState(mockResult), ShouldBeTrue)
			})

			Convey("alert state have changed", func() {
				mockAlertState = &m.AlertState{
					NewState: alertstates.Critical,
				}
				mockResult.State = alertstates.Ok
				So(resultHandler.shouldUpdateState(mockResult), ShouldBeTrue)
			})

			Convey("last alert state was 15min ago", func() {
				now := time.Now()
				mockAlertState = &m.AlertState{
					NewState: alertstates.Critical,
					Created:  now.Add(time.Minute * -30),
				}
				mockResult.State = alertstates.Critical
				So(resultHandler.shouldUpdateState(mockResult), ShouldBeTrue)
			})
		})
	})
}
