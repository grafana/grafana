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

// this channel decouples the secondly tick from the dispatching (which is mainly database querying)
// so that temporarily database hickups don't block the ticker.
// however, if more than the given number of dispatch timestamps (ticks) queue up, than the database is really unreasonably slow
// and grafana will skip the tick, resulting in lost job executions for that second.
// so set this to whatever value you find tolerable, and watch your database query times.
// TODO configurable
var tickQueueSize = 20
var tickQueue = make(chan time.Time, tickQueueSize)

// Dispatcher dispatches, every second, all jobs that should run for that second
// every job has an id so that you can run multiple dispatchers (for HA) while still only processing each job once.
// (provided jobs get consistently routed to executors)
func Dispatcher(jobQueue chan<- Job) {
	Stat.IncrementValue("alert-dispatcher.ticks-skipped-due-to-slow-tickqueue", 0)
	go dispatchJobs(jobQueue)
	for {
		ticker := getAlignedTicker()
		select {
		case t := <-ticker.C:
			Stat.Gauge("alert-tickqueue.items", int64(len(tickQueue)))
			Stat.Gauge("alert-tickqueue.size", int64(tickQueueSize))
			select {
			case tickQueue <- t:
			default:
				// TODO: alert when this happens
				Stat.Increment("alert-dispatcher.ticks-skipped-due-to-slow-tickqueue")
			}
		}
	}
}

func dispatchJobs(jobQueue chan<- Job) {
	Stat.IncrementValue("alert-dispatcher.jobs-skipped-due-to-slow-jobqueue", 0)
	for t := range tickQueue {
		Stat.Gauge("alert-tickqueue.items", int64(len(tickQueue)))
		Stat.Gauge("alert-tickqueue.size", int64(tickQueueSize))
		normalizedTime := t.Unix()

		// for now, for simplicity, let's just wait 30seconds for the data to come in
		// let's say jobs with freq 60 and offset 7 trigger at 7, 67, 127, ...
		// we just query at 37, 97, 157, ...
		// so we should find the checks where ts-30 % frequency == offset
		// and then ts-30 was a ts of the last point we should query for

		lastPointAt := normalizedTime - 30

		pre := time.Now()
		jobs, err := getJobs(lastPointAt)
		Stat.TimeDuration("alert-dispatcher.get-schedules", time.Since(pre))

		if err != nil {
			fmt.Println("CRITICAL", err) // TODO better way to log errors
			continue
		}

		Stat.IncrementValue("alert-dispatcher.job-schedules-seen", int64(len(jobs)))
		for _, job := range jobs {
			/*job := Job{
				// note: we don't include the timestamp here so that jobs for same monitor id get routed to same place
				// this is not really a necessity but might be useful in the future if we want to get stateful and leverage
				// output from past jobs.
				fmt.Sprintf("%d", sched.MonitorId),
				sched.OrgId,
				sched.Definition,
				t,
				time.Unix(lastPointAt, 0),
			}*/
			job.GeneratedAt = t
			job.LastPointTs = time.Unix(lastPointAt, 0)

			Stat.Gauge("alert-jobqueue-internal.items", int64(len(jobQueue)))
			Stat.Gauge("alert-jobqueue-internal.size", int64(jobQueueSize))
			select {
			case jobQueue <- *job:
			default:
				// TODO: alert when this happens
				Stat.Increment("alert-dispatcher.jobs-skipped-due-to-slow-jobqueue")
			}
			Stat.Increment("alert-dispatcher.jobs-scheduled")
		}
	}
}
