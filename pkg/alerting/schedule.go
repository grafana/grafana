package alerting

import (
	"bytes"
	"fmt"
	"strings"
	"text/template"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

type Schedule struct {
	MonitorId  int64
	OrgId      int64
	Freq       int64
	Offset     int64 // offset on top of "even" minute/10s/.. intervals
	Definition CheckDef
}

func getSchedules(lastPointAt int64) ([]Schedule, error) {

	query := m.GetMonitorsQuery{
		IsGrafanaAdmin: true,
		Timestamp:      lastPointAt,
	}

	if err := bus.Dispatch(&query); err != nil {
		return nil, err
	}

	schedules := make([]Schedule, 0)
	for _, monitor := range query.Result {
		schedules = append(schedules, buildScheduleForMonitor(monitor))
	}

	return schedules, nil
}

func buildScheduleForMonitor(monitor *m.MonitorDTO) Schedule {
	//state could in theory be ok, warn, error, but we only use ok vs error for now

	if monitor.Frequency == 0 || monitor.HealthSettings.Steps == 0 || monitor.HealthSettings.NumCollectors == 0 {
		panic(fmt.Sprintf("bad monitor definition given: %#v", monitor))
	}

	type Settings struct {
		EndpointSlug    string
		MonitorTypeName string
		Duration        string
		NumCollectors   int
		Steps           int
	}

	// graphite behaves like so:
	// from is exclusive (from=foo returns data at ts=foo+1 and higher)
	// until is inclusive (until=bar returns data at ts=bar and lower)
	// so if lastPointAt is 1000, and Steps = 3 and Frequency is 10
	// we want points with timestamps 980, 990, 1000
	// we can just query from 970

	settings := Settings{
		EndpointSlug:    monitor.EndpointSlug,
		MonitorTypeName: monitor.MonitorTypeName,
		Duration:        fmt.Sprintf("%d", int64(monitor.HealthSettings.Steps)*monitor.Frequency),
		NumCollectors:   monitor.HealthSettings.NumCollectors,
		Steps:           monitor.HealthSettings.Steps,
	}

	funcMap := template.FuncMap{
		"ToLower": strings.ToLower,
	}

	// graphite returns 1 series of <steps> points, each the sum of the errors of all enabled collectors
	// bosun transforms each point into 1 if the sum >= numcollectors, or 0 if not
	// we then ask bosun to sum up these points into a single number. if this value equals the number of points, it means for each point the above step was true (1).

	target := `sum({{.EndpointSlug}}.*.network.{{.MonitorTypeName | ToLower }}.error_state)`
	tpl := `sum(graphite("` + target + `", "{{.Duration}}s", "", "") >= {{.NumCollectors}}) == {{.Steps}}`

	var t = template.Must(template.New("query").Funcs(funcMap).Parse(tpl))
	var b bytes.Buffer
	err := t.Execute(&b, settings)
	if err != nil {
		panic(err)
	}
	s := Schedule{
		MonitorId: monitor.Id,
		OrgId:     monitor.OrgId,
		Freq:      monitor.Frequency,
		Offset:    monitor.Offset,
		Definition: CheckDef{
			CritExpr: b.String(),
			WarnExpr: "0", // for now we have only good or bad. so only crit is needed
		},
	}
	return s
}
