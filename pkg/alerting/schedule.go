package alerting

import (
	"bytes"
	"strings"
	"text/template"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

type Schedule struct {
	OrgId      int64
	Freq       int64
	Offset     int64 // offset on top of "even" minute/10s/.. intervals
	Definition CheckDef
}

//ts timestamps at which (or a bit later) checks will run
func getSchedules(ts int64) ([]Schedule, error) {
	// for now, for simplicity, let's just wait 30seconds for the data to come in
	// let's say jobs with freq 60 and offset 7 trigger at 7, 67, 127, ...
	// we just query at 37, 97, 157, ...
	// so we should find the checks where ts-30 % frequency == offset
	// and then ts-30 was a ts of the last point we should query for

	// and then we query graphite, which behaves like so:
	// from is exclusive (from=foo returns data at ts=foo+1 and higher)
	// until is inclusive (until=bar returns data at ts=bar and lower)

	query := m.GetMonitorsQuery{
		IsGrafanaAdmin: true,
		Timestamp:      ts - 30,
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

	// temporary overrides since we don't have the data saved yet.
	monitor.HealthSettings.NumCollectors = 7
	monitor.HealthSettings.Steps = 2

	funcMap := template.FuncMap{
		"ToLower": strings.ToLower,
	}

	// TODO fix "from" arg
	// graphite returns 1 series of <steps> points, each the sum of the errors of all enabled collectors
	// bosun transforms each point into 1 if the sum >= numcollectors, or 0 if not
	// we then ask bosun to sum up these points into a single number. if this value equals the number of points, it means for each point the above step was true (1).

	target := `sum({{.EndpointSlug}}.*.network.{{.MonitorTypeName | ToLower }}.error_state)`
	tpl := `sum(graphite("` + target + `", "{{.HealthSettings.Steps}}m", "", "") >= {{.HealthSettings.NumCollectors}}) == {{.HealthSettings.Steps}}`

	var t = template.Must(template.New("query").Funcs(funcMap).Parse(tpl))
	var b bytes.Buffer
	err := t.Execute(&b, monitor)
	if err != nil {
		panic(err)
	}
	s := Schedule{
		OrgId:  monitor.OrgId,
		Freq:   monitor.Frequency,
		Offset: monitor.Offset,
		Definition: CheckDef{
			CritExpr: b.String(),
			WarnExpr: "0", // for now we have only good or bad. so only crit is needed
		},
	}
	return s
}
