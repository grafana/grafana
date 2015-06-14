package alerting

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/hashicorp/golang-lru"

	"bosun.org/graphite"
)

type GraphiteReturner func(org_id int64) graphite.Context

type GraphiteContext struct {
	hh          graphite.HostHeader
	lock        sync.Mutex
	dur         time.Duration
	missingVals int
	emptyResp   bool
}

func (gc *GraphiteContext) Query(r *graphite.Request) (graphite.Response, error) {
	pre := time.Now()
	res, err := gc.hh.Query(r)
	// currently I believe bosun doesn't do concurrent queries, but we should just be safe.
	gc.lock.Lock()
	defer gc.lock.Unlock()
	for _, s := range res {
		for _, p := range s.Datapoints {
			if p[0] == "" {
				gc.missingVals += 1
			}
		}
	}
	gc.emptyResp = (len(res) == 0)

	// one Context might run multiple queries, we want to add all times
	gc.dur += time.Since(pre)
	if gc.missingVals > 0 {
		return res, fmt.Errorf("GraphiteContext saw %d unknown values returned from server", gc.missingVals)
	}
	return res, err
}

func GraphiteAuthContextReturner(org_id int64) graphite.Context {
	url, err := url.Parse(setting.GraphiteUrl)
	if err != nil {
		panic("could not parse graphiteUrl")
	}
	return &GraphiteContext{
		hh: graphite.HostHeader{
			Host: url.Host,
			Header: http.Header{
				"X-Org-Id": []string{fmt.Sprintf("%d", org_id)},
			},
		},
	}
}

func Executor(fn GraphiteReturner, jobQueue <-chan Job) {
	cache, err := lru.New(10000) // TODO configurable
	if err != nil {
		panic(fmt.Sprintf("Can't create LRU: %s", err.Error()))
	}
	// create series explicitly otherwise the grafana-influxdb graphs don't work if the series doesn't exist
	Stat.IncrementValue("alert-executor.alert-outcomes.ok", 0)
	Stat.IncrementValue("alert-executor.alert-outcomes.critical", 0)
	Stat.IncrementValue("alert-executor.alert-outcomes.unknown", 0)
	Stat.IncrementValue("alert-executor.graphite-emptyresponse", 0)
	Stat.TimeDuration("alert-executor.consider-job.already-done", 0)
	Stat.TimeDuration("alert-executor.consider-job.original-todo", 0)

	for job := range jobQueue {
		Stat.Gauge("alert-jobqueue-internal.items", int64(len(jobQueue)))
		Stat.Gauge("alert-jobqueue-internal.size", int64(jobQueueSize))

		key := fmt.Sprintf("%s-%d", job.Key, job.LastPointTs.Unix())

		preConsider := time.Now()

		if _, ok := cache.Get(key); ok {
			fmt.Println("T ", key, "already done")
			Stat.TimeDuration("alert-executor.consider-job.already-done", time.Since(preConsider))
			continue
		}

		fmt.Println("T ", key, "doing")
		Stat.TimeDuration("alert-executor.consider-job.original-todo", time.Since(preConsider))
		gr := fn(job.OrgId)

		preExec := time.Now()
		evaluator, err := NewGraphiteCheckEvaluator(gr, job.Definition)
		if err != nil {
			// expressions should be validated before they are stored in the db
			// if they fail now it's a critical error
			panic(fmt.Sprintf("received invalid check definition '%s': %s", job.Definition, err))
		}

		res, err := evaluator.Eval(job.LastPointTs)
		//fmt.Println("job results", job, err, res)

		durationExec := time.Since(preExec)
		if job.State != res {
			//monitor state has changed.
			updateMonitorStateCmd := m.UpdateMonitorStateCommand{
				Id:      job.MonitorId,
				State:   res,
				Updated: job.LastPointTs,
			}
			if err := bus.Dispatch(&updateMonitorStateCmd); err != nil {
				panic(fmt.Sprintf("failed to update monitor state. %s", err.Error()))
			}
			//emit a state change event.
			if job.Notifications.Enabled {
				emails := strings.Split(job.Notifications.Addresses, ",")
				if len(emails) < 1 {
					fmt.Printf("no email addresses provided.")
					continue
				}
				sendCmd := m.SendEmailCommand{
					To:       emails,
					Template: "alerting_notification.html",
					Data: map[string]interface{}{
						"Endpoint":  job.EndpointSlug,
						"CheckType": job.MonitorTypeName,
						"State":     res.String(),
					},
				}

				if err := bus.Dispatch(&sendCmd); err != nil {
					fmt.Printf("failed to send email to %s.", emails)
					fmt.Println(err)
				}
			}
		}
		//store the result in graphite.
		job.StoreResult(res)

		// the bosun api abstracts parsing, execution and graphite querying for us via 1 call.
		// we want to have some individual times
		if gr, ok := gr.(*GraphiteContext); ok {
			Stat.TimeDuration("alert-executor.job_query_graphite", gr.dur)
			Stat.TimeDuration("alert-executor.job_parse-and-evaluate", durationExec-gr.dur)
			Stat.Timing("alert-executor.graphite-missingVals", int64(gr.missingVals))
			if gr.emptyResp {
				Stat.Increment("alert-executor.graphite-emptyresponse")
			}
		}

		Stat.Increment(strings.ToLower(fmt.Sprintf("alert-executor.alert-outcomes.%s", res)))

		cache.Add(key, true)
	}
}
