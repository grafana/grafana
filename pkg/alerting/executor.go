package alerting

import (
	"fmt"
	"net/http"
	"net/url"
	"path"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
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
	u, err := url.Parse(setting.GraphiteUrl)
	if err != nil {
		panic(fmt.Sprintf("could not parse graphiteUrl: %s", err))
	}
	u.Path = path.Join(u.Path, "render/")
	return &GraphiteContext{
		hh: graphite.HostHeader{
			Host: u.String(),
			Header: http.Header{
				"X-Org-Id": []string{fmt.Sprintf("%d", org_id)},
			},
		},
	}
}

func Executor(fn GraphiteReturner, jobQueue <-chan Job, cache *lru.Cache) {
	executorNum.Inc(1)
	defer executorNum.Dec(1)

	for job := range jobQueue {
		jobQueueInternalItems.Value(int64(len(jobQueue)))
		jobQueueInternalSize.Value(int64(setting.JobQueueSize))

		key := fmt.Sprintf("%d-%d", job.MonitorId, job.LastPointTs.Unix())

		preConsider := time.Now()

		if found, _ := cache.ContainsOrAdd(key, true); found {
			log.Debug("T %s already done", key)
			executorNumAlreadyDone.Inc(1)
			executorConsiderJobAlreadyDone.Value(time.Since(preConsider))
			continue
		}

		log.Debug("T %s doing", key)
		executorNumOriginalTodo.Inc(1)
		executorConsiderJobOriginalTodo.Value(time.Since(preConsider))
		gr := fn(job.OrgId)

		preExec := time.Now()
		evaluator, err := NewGraphiteCheckEvaluator(gr, job.Definition)
		if err != nil {
			// expressions should be validated before they are stored in the db
			// if they fail now it's a critical error
			panic(fmt.Sprintf("received invalid check definition '%s': %s", job.Definition, err))
		}

		res, err := evaluator.Eval(job.LastPointTs)
		log.Debug("job results - job:%v err:%v res:%v", job, err, res)

		durationExec := time.Since(preExec)
		if job.State != res {
			//monitor state has changed.
			updateMonitorStateCmd := m.UpdateMonitorStateCommand{
				Id:      job.MonitorId,
				State:   res,
				Updated: job.LastPointTs,
			}
			if err := bus.Dispatch(&updateMonitorStateCmd); err != nil {
				//check if we failed due to deadlock.
				if err.Error() == "Error 1213: Deadlock found when trying to get lock; try restarting transaction" {
					err = bus.Dispatch(&updateMonitorStateCmd)
					if err == nil {
						continue
					}
				}
				log.Error(0, "failed to update monitor state", err)
			}
			//emit a state change event.
			if job.Notifications.Enabled {
				emails := strings.Split(job.Notifications.Addresses, ",")
				if len(emails) < 1 {
					log.Debug("no email addresses provided. OrgId: %d monitorId: %d", job.OrgId, job.MonitorId)
					continue
				}
				sendCmd := m.SendEmailCommand{
					To:       emails,
					Template: "alerting_notification.html",
					Data: map[string]interface{}{
						"Endpoint":   job.EndpointSlug,
						"EndpointId": job.EndpointId,
						"CheckType":  job.MonitorTypeName,
						"State":      res.String(),
						"Timestamp":  job.LastPointTs,
					},
				}

				if err := bus.Dispatch(&sendCmd); err != nil {
					log.Info("failed to send email to %s. OrgId: %d monitorId: %d", emails, job.OrgId, job.MonitorId, err)
				}
			}
		}
		//store the result in graphite.
		job.StoreResult(res)

		// the bosun api abstracts parsing, execution and graphite querying for us via 1 call.
		// we want to have some individual times
		if gr, ok := gr.(*GraphiteContext); ok {
			executorJobQueryGraphite.Value(gr.dur)
			executorJobParseAndEval.Value(durationExec - gr.dur)
			executorGraphiteMissingVals.Value(int64(gr.missingVals))
			if gr.emptyResp {
				executorGraphiteEmptyResponse.Inc(1)
			}
		}

		switch res {
		case m.EvalResultOK:
			executorAlertOutcomesOk.Inc(1)
		case m.EvalResultWarn:
			executorAlertOutcomesWarn.Inc(1)
		case m.EvalResultCrit:
			executorAlertOutcomesCrit.Inc(1)
		case m.EvalResultUnknown:
			executorAlertOutcomesUnkn.Inc(1)
		}

	}
}
