package alerting

import (
	"testing"
	"time"

	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestScheduleBuilding(t *testing.T) {

	Convey("Can build schedules from monitor configs", t, func() {
		m := &m.MonitorForAlertDTO{
			EndpointSlug:    "test_endpoint_be",
			MonitorTypeName: "smtp",
			Frequency:       60,
			Offset:          37,
			HealthSettings: &m.MonitorHealthSettingDTO{
				NumCollectors: 16,
				Steps:         5,
			},
			Created: time.Unix(0, 0),
		}
		sched := buildJobForMonitor(m, 240)
		if sched != nil {
			t.Errorf("monitor created at 0 with 5 steps and freq of 60 is not warmed up yet by 240")
		}
		sched = buildJobForMonitor(m, 400)
		if sched == nil {
			t.Errorf("monitor created at 0 with 5 steps and freq of 60 should be warmed up by 400")
		}

		if sched.Freq != 60 {
			t.Errorf("sched.Freq should be 60, not %d", sched.Freq)
		}
		if sched.Offset != 37 {
			t.Errorf("sched.Offset should be 37, not %d", sched.Offset)
		}
		critExpr := `sum(t(streak(graphite("litmus.test_endpoint_be.*.smtp.error_state", "300s", "", "")) == 5 , "")) >= 16`
		if sched.Definition.CritExpr != critExpr {
			t.Errorf("sched.Definition.CritExpr should be '%s' not '%s'", critExpr, sched.Definition.CritExpr)
		}
	})
}
