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

	lastPointAt := ts - 30

	query := m.GetMonitorsQuery{
		IsGrafanaAdmin: true,
		Timestamp:      lastPointAt,
	}

	if err := bus.Dispatch(&query); err != nil {
		return nil, err
	}

	schedules := make([]Schedule, 0)
	for _, monitor := range query.Result {
		schedules = append(schedules, buildScheduleForMonitor(monitor, lastPointAt))
	}

	return schedules, nil
}

func buildScheduleForMonitor(monitor *m.MonitorDTO, lastPointAt int64) Schedule {
	//state could in theory be ok, warn, error, but we only use ok vs error for now

	if monitor.Frequency == 0 || monitor.HealthSettings.Steps == 0 || monitor.HealthSettings.NumCollectors == 0 {
		panic(fmt.Sprintf("bad monitor definition given: %#v", monitor))
	}

	type Settings struct {
		EndpointSlug    string
		MonitorTypeName string
		From            string
		Until           string
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
		From:            fmt.Sprintf("%d", lastPointAt-int64(monitor.HealthSettings.Steps)*monitor.Frequency),
		Until:           fmt.Sprintf("%d", lastPointAt),
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
	tpl := `sum(graphite("` + target + `", "{{.From}}", "{{.Until}}", "") >= {{.NumCollectors}}) == {{.Steps}}`

	var t = template.Must(template.New("query").Funcs(funcMap).Parse(tpl))
	var b bytes.Buffer
	err := t.Execute(&b, settings)
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
