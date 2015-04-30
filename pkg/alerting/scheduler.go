package alerting

import (
	"fmt"
	"net/http"
	"time"

	"bosun.org/graphite"
)

// func (check *Check) getDataSource() {
//  dsQuery := m.GetDataSourceByIdQuery{Id: check.Id}
//
//  if err := bus.Dispatch(&dsQuery); err != nil {
//      return nil, err
//  }
//
//  return dsQuery.Result
// }

type Schedule struct {
	//Id           int64
	//OrgId        int64
	//DataSourceId int64
	Freq       uint32
	Offset     uint8 // offset on top of "even" minute/10s/.. intervals
	Definition CheckDef
}

// getAlignedTicker returns a ticker that ticks at the next second or very shortly after
func getAlignedTicker() *time.Ticker {
	unix := time.Now().UnixNano()
	diff := time.Duration(time.Second - (time.Duration(unix) % time.Second))
	return time.NewTicker(diff)
}

type Job struct {
	key        string
	Definition CheckDef
	ts         time.Time // sets an explicit "until" to match the data this alert run is meant for, even when execution is delayed
}

func (job Job) String() string {
	return fmt.Sprintf("<Job> key=%s time=%s definition: %s", job.key, job.ts, job.Definition)
}

var queue = make(chan Job) // TODO: use rabbitmq or something so we can have multiple grafana dispatchers and executors
var dispatch = make(chan time.Time, 5)

// Dispatcher dispatches, every second, all jobs that should run for that second
// every job has an id so that you can run multiple dispatchers (for HA) while still only processing each job once.
// (provided jobs get consistently routed to executors)
func Dispatcher() {
	go dispatchJobs()
	for {
		ticker := getAlignedTicker()
		select {
		case t := <-ticker.C:
			select {
			case dispatch <- t:
			default:
				panic(fmt.Sprintf("dispatchJobs() can't keep up. database too slow?"))
			}
		}
	}
}

func dispatchJobs() {
	for t := range dispatch {
		normalizedTime := t.Unix()
		fmt.Println(t, "querying for jobs that should run in second", normalizedTime)
		// TODO query for real jobs

		schedules := []Schedule{
			Schedule{
				Freq:   10,
				Offset: 1,
				Definition: CheckDef{
					// TODO make sure graphite always returns 2 points for this kind of request
					//`median(graphite("apps.fakesite.web_server_01.counters.requests.count","2m","","")) < 0`,
					//`median(graphite("avg(apps.fakesite.web_server_*.counters.requests.count)","2m","","")) > 1`,
					`sum(graphite("sum(dieter_plaetinck_be.*.network.http.ok_state)", "2m", "", "") > 0) > 1`,
					`sum(graphite("sum(dieter_plaetinck_be.*.network.http.ok_state)", "2m", "", "") > 0) > 1`,
				},
			},
		}
		for _, sched := range schedules {
			queue <- Job{
				fmt.Sprintf("alert-id_%d", normalizedTime),
				sched.Definition,
				t,
			}
		}
	}
}

func Executor() {
	// TODO: once i have my own linux dev machine i can easily run docker and will nice authenticated requests to configured source
	gr := graphite.HostHeader{
		//"play.grafana.org/api/datasources/proxy/1",
		"localhost:32778",
		http.Header{
			"X-Org-Id": []string{"1"},
		}}

	for job := range queue {
		// note: if timestamp is very old, we still process. better to be backlogged then not do jobs, up to operator to make system keep up
		// if timestamp is in future, we still process and assume that whoever created the job knows what they are doing.
		// TODO: ignore jobs already processed
		evaluator, err := NewGraphiteCheckEvaluator(gr, job.Definition)
		if err != nil {
			// expressions should be validated before they are stored in the db
			// if they fail now it's a critical error
			panic(fmt.Sprintf("received invalid check definition '%s': %s", err))
		}

		res, err := evaluator.Eval(job.ts)
		fmt.Println(job, err, res)
	}
}
