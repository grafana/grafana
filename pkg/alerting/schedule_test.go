package alerting

import (
	"testing"

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
		}
		sched := buildJobForMonitor(m)

		if sched.Freq != 60 {
			t.Errorf("sched.Freq should be 60, not %d", sched.Freq)
		}
		if sched.Offset != 37 {
			t.Errorf("sched.Offset should be 37, not %d", sched.Offset)
		}
		critExpr := "sum(graphite(\"sum(litmus.test_endpoint_be.*.smtp.error_state)\", \"300s\", \"\", \"\") >= 16) == 5"
		if sched.Definition.CritExpr != critExpr {
			t.Errorf("sched.Definition.CritExpr should be '%s' not '%s'", critExpr, sched.Definition.CritExpr)
		}
	})
}
