package alerting

import (
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/davecgh/go-spew/spew"
	"github.com/grafana/grafana/pkg/setting"

	"bosun.org/graphite"
)

type keysSeen struct {
	ts   int64
	seen map[string]struct{}
}

func NewKeysSeen(ts int64) *keysSeen {
	return &keysSeen{
		ts:   ts,
		seen: make(map[string]struct{}),
	}
}

type GraphiteReturner func(org_id int64) graphite.Context

type GraphiteContext struct {
	hh          graphite.HostHeader
	lock        sync.Mutex
	dur         time.Duration
	missingVals int
}

func (gc *GraphiteContext) Query(r *graphite.Request) (graphite.Response, error) {
	pre := time.Now()
	fmt.Println(r, "GRAPHITE START")
	res, err := gc.hh.Query(r)
	spew.Dump(res)
	// currently I believe bosun doesn't do concurrent queries, but we should just be safe.
	gc.lock.Lock()
	for _, s := range res {
		for _, p := range s.Datapoints {
			if p[0] == "" {
				gc.missingVals += 1
			}
		}
	}
	// one Context might run multiple queries, we want to add all times
	gc.dur += time.Since(pre)
	if gc.missingVals > 0 {
		return res, fmt.Errorf("GraphiteContext saw %d unknown values returned from server", gc.missingVals)
	}
	gc.lock.Unlock()
	fmt.Println(r, "GRAPHITE STOP")
	return res, err
}

func GraphiteAuthContextReturner(org_id int64) graphite.Context {
	return &GraphiteContext{
		hh: graphite.HostHeader{
			Host: setting.GraphiteUrl,
			Header: http.Header{
				"X-Org-Id": []string{fmt.Sprintf("%d", org_id)},
			},
		},
	}
}

func Executor(fn GraphiteReturner) {
	var keysSeenLastSecond *keysSeen
	var keysSeenCurrentSecond *keysSeen

	for job := range jobQueue {
		Stat.Gauge("alert-jobqueue-internal.items", int64(len(jobQueue)))
		Stat.Gauge("alert-jobqueue-internal.size", int64(jobQueueSize))
		unix := job.lastPointTs.Unix()
		preConsider := time.Now()
		if keysSeenCurrentSecond != nil && unix == keysSeenCurrentSecond.ts {
			if _, ok := keysSeenCurrentSecond.seen[job.key]; ok {
				Stat.TimeDuration("alert-executor.consider-job.already-done", time.Since(preConsider))
				continue
			}
		}
		if keysSeenLastSecond != nil && unix == keysSeenLastSecond.ts {
			if _, ok := keysSeenLastSecond.seen[job.key]; ok {
				Stat.TimeDuration("alert-executor.consider-job.already-done", time.Since(preConsider))
				continue
			}
		}
		if keysSeenCurrentSecond == nil {
			keysSeenCurrentSecond = NewKeysSeen(unix)
		}
		if unix > keysSeenCurrentSecond.ts {
			keysSeenLastSecond = keysSeenCurrentSecond
			keysSeenCurrentSecond = NewKeysSeen(unix)
		}
		// skip old job if we've seen newer
		if (keysSeenLastSecond != nil && unix < keysSeenLastSecond.ts) || unix < keysSeenCurrentSecond.ts {
			Stat.TimeDuration("alert-executor.consider-job.out-of-date", time.Since(preConsider))
			continue
		}
		Stat.TimeDuration("alert-executor.consider-job.original-todo", time.Since(preConsider))
		// note: if timestamp is very old (and we haven't processed anything newer),
		// we still process. better to be backlogged then not do jobs, up to operator to make system keep up
		// if timestamp is in future, we still process and assume that whoever created the job knows what they are doing.

		gr := fn(job.OrgId)

		preExec := time.Now()
		evaluator, err := NewGraphiteCheckEvaluator(gr, job.Definition)
		if err != nil {
			// expressions should be validated before they are stored in the db
			// if they fail now it's a critical error
			panic(fmt.Sprintf("received invalid check definition '%s': %s", job.Definition, err))
		}

		res, err := evaluator.Eval(job.lastPointTs)
		fmt.Println(job, err, res)
		durationExec := time.Since(preExec)
		// the bosun api abstracts parsing, execution and graphite querying for us via 1 call.
		// we want to have some individual times
		if gr, ok := gr.(*GraphiteContext); ok {
			Stat.TimeDuration("alert-executor.job_query_graphite", gr.dur)
			Stat.TimeDuration("alert-executor.job_parse-and-evaluate", durationExec-gr.dur)
		}

		Stat.Increment(fmt.Sprintf("alert-executor.alert-outcomes.%s", res))

		keysSeenCurrentSecond.seen[job.key] = struct{}{}

	}
}
