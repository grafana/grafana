package alerting

import (
	"fmt"
	"time"
)

// getAlignedTicker returns a ticker that ticks at the next second or very shortly after
func getAlignedTicker() *time.Ticker {
	unix := time.Now().UnixNano()
	diff := time.Duration(time.Second - (time.Duration(unix) % time.Second))
	return time.NewTicker(diff)
}

type Job struct {
	key        string
	OrgId      int64
	Definition CheckDef
	ts         time.Time // sets an explicit "until" to match the data this alert run is meant for, even when execution is delayed
}

func (job Job) String() string {
	return fmt.Sprintf("<Job> key=%s time=%s definition: %s", job.key, job.ts, job.Definition)
}

// this channel decouples the secondly tick from the dispatching (which is mainly database querying)
// so that temporarily database hickups don't block the ticker.
// however, if more than the given number of dispatch timestamps (ticks) queue up, than the database is really unreasonably slow
// and grafana will error out. so set this to whatever value you find tolerable, and watch your database query times.
// TODO configurable, instrument number in queue
var tickQueue = make(chan time.Time, 5)

// this should be set to above the max amount of jobs you expect to ever be invoked in 1 shot
// so we can queue them all at once and then workers can process them
// TODO configurable, instrument number in queue
// at some point we'll support rabbitmq or something so we can have multiple grafana dispatchers and executors.
var jobQueue = make(chan Job, 10)

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
			case tickQueue <- t:
			default:
				panic(fmt.Sprintf("dispatchJobs() can't keep up with clock. database too slow?"))
			}
		}
	}
}

func dispatchJobs() {
	for t := range tickQueue {
		normalizedTime := t.Unix()
		fmt.Println(t, "querying for jobs that should run in second", normalizedTime)
		schedules, err := getSchedules(normalizedTime)
		if err != nil {
			fmt.Println("CRITICAL", err) // TODO better way to log errors
			continue
		}
		for _, sched := range schedules {
			job := Job{
				fmt.Sprintf("alert-id_%d", normalizedTime),
				sched.OrgId,
				sched.Definition,
				t,
			}
			select {
			case jobQueue <- job:
			default:
				panic(fmt.Sprintf("job queue can't keep up with dispatched jobs. workers not processing fast enough"))
			}
		}
	}
}
