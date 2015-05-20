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
var tickQueueSize = 20
var tickQueue = make(chan time.Time, tickQueueSize)

// this should be set to above the max amount of jobs you expect to ever be invoked in 1 shot
// so we can queue them all at once and then workers can process them
// TODO configurable, instrument number in queue
// at some point we'll support rabbitmq or something so we can have multiple grafana dispatchers and executors.
var jobQueueSize = 100
var jobQueue = make(chan Job, jobQueueSize)

// Dispatcher dispatches, every second, all jobs that should run for that second
// every job has an id so that you can run multiple dispatchers (for HA) while still only processing each job once.
// (provided jobs get consistently routed to executors)
func Dispatcher() {
	go dispatchJobs()
	for {
		ticker := getAlignedTicker()
		select {
		case t := <-ticker.C:
			Stat.Gauge("alert-tickqueue.items", int64(len(tickQueue)))
			Stat.Gauge("alert-tickqueue.size", int64(tickQueueSize))
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
		Stat.Gauge("alert-tickqueue.items", int64(len(tickQueue)))
		Stat.Gauge("alert-tickqueue.size", int64(tickQueueSize))
		normalizedTime := t.Unix()

		pre := time.Now()
		schedules, err := getSchedules(normalizedTime)
		Stat.TimeDuration("alert-dispatcher.get-schedules", time.Since(pre))

		if err != nil {
			fmt.Println("CRITICAL", err) // TODO better way to log errors
			continue
		}

		Stat.IncrementValue("alert-dispatcher.job-schedules-seen", int64(len(schedules)))
		for _, sched := range schedules {
			job := Job{
				fmt.Sprintf("alert-id_%d", normalizedTime),
				sched.OrgId,
				sched.Definition,
				t,
			}
			Stat.Gauge("alert-jobqueue-internal.items", int64(len(jobQueue)))
			Stat.Gauge("alert-jobqueue-internal.size", int64(jobQueueSize))
			select {
			case jobQueue <- job:
			default:
				panic(fmt.Sprintf("job queue can't keep up with dispatched jobs. workers not processing fast enough"))
			}
			Stat.Increment("alert-dispatcher.jobs-scheduled")
		}
	}
}
