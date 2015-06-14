package alerting

import (
	"bytes"
	"fmt"
	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"strings"
	"text/template"
	"time"
)

// Job is a job for an alert execution
// note that LastPointTs is a time denoting the timestamp of the last point to run against
// this way the check runs always on the right data, irrespective of execution delays
// that said, for convenience, we track the generatedAt timestamp
type Job struct {
	Key             string
	OrgId           int64
	MonitorId       int64
	EndpointId      int64
	EndpointSlug    string
	MonitorTypeName string
	Notifications   m.MonitorNotificationSetting
	Freq            int64
	Offset          int64 // offset on top of "even" minute/10s/.. intervals
	State           m.CheckEvalResult
	Definition      CheckDef
	GeneratedAt     time.Time
	LastPointTs     time.Time
	StoreMetricFunc func(m *m.MetricDefinition) `json:"-"`
}

func (job Job) String() string {
	return fmt.Sprintf("<Job> key=%s generatedAt=%s lastPointTs=%s definition: %s", job.Key, job.GeneratedAt, job.LastPointTs, job.Definition)
}

func (job Job) StoreResult(res m.CheckEvalResult) {
	if job.StoreMetricFunc == nil {
		return
	}
	metrics := make([]*m.MetricDefinition, 3)
	metricNames := [3]string{"ok_state", "warn_state", "error_state"}
	for pos, state := range metricNames {
		metrics[pos] = &m.MetricDefinition{
			OrgId:      job.OrgId,
			Name:       fmt.Sprintf("health.%s.%s.%s", job.EndpointSlug, strings.ToLower(job.MonitorTypeName), state),
			Metric:     fmt.Sprintf("health.%s.%s", strings.ToLower(job.MonitorTypeName), state),
			Interval:   job.Freq,
			Value:      0.0,
			Unit:       "state",
			Time:       job.LastPointTs.Unix(),
			TargetType: "gauge",
			Extra: map[string]interface{}{
				"endpoint_id": job.EndpointId,
				"monitor_id":  job.MonitorId,
			},
		}
	}
	if int(res) >= 0 {
		metrics[int(res)].Value = 1.0
	}
	for _, m := range metrics {
		job.StoreMetricFunc(m)
	}
}

func getJobs(lastPointAt int64) ([]*Job, error) {

	query := m.GetMonitorsForAlertsQuery{
		Timestamp: lastPointAt,
	}

	if err := bus.Dispatch(&query); err != nil {
		return nil, err
	}

	jobs := make([]*Job, 0)
	for _, monitor := range query.Result {
		job := buildJobForMonitor(monitor)
		if job != nil {
			jobs = append(jobs, job)
		}
	}

	return jobs, nil
}

func buildJobForMonitor(monitor *m.MonitorForAlertDTO) *Job {
	//state could in theory be ok, warn, error, but we only use ok vs error for now

	if monitor.HealthSettings == nil {
		return nil
	}

	if monitor.Frequency == 0 || monitor.HealthSettings.Steps == 0 || monitor.HealthSettings.NumCollectors == 0 {
		//fmt.Printf("bad monitor definition given: %#v", monitor)
		return nil
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

	target := `sum(litmus.{{.EndpointSlug}}.*.{{.MonitorTypeName | ToLower }}.error_state)`
	tpl := `sum(graphite("` + target + `", "{{.Duration}}s", "", "") >= {{.NumCollectors}}) == {{.Steps}}`

	var t = template.Must(template.New("query").Funcs(funcMap).Parse(tpl))
	var b bytes.Buffer
	err := t.Execute(&b, settings)
	if err != nil {
		panic(err)
	}
	j := &Job{
		Key:             fmt.Sprintf("%d", monitor.Id),
		MonitorId:       monitor.Id,
		EndpointId:      monitor.EndpointId,
		EndpointSlug:    monitor.EndpointSlug,
		MonitorTypeName: monitor.MonitorTypeName,
		Notifications:   monitor.HealthSettings.Notifications,
		OrgId:           monitor.OrgId,
		Freq:            monitor.Frequency,
		Offset:          monitor.Offset,
		State:           monitor.State,
		Definition: CheckDef{
			CritExpr: b.String(),
			WarnExpr: "0", // for now we have only good or bad. so only crit is needed
		},
		StoreMetricFunc: api.StoreMetric,
	}
	return j
}
