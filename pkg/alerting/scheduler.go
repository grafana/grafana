package alerting

import (
	"fmt"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana/pkg/setting"
)

// this channel decouples the secondly tick from the dispatching (which is mainly database querying)
// so that temporarily database hickups don't block the ticker.
var tickQueue = make(chan time.Time, setting.TickQueueSize)

// Dispatcher dispatches, every second, all jobs that should run for that second
// every job has an id so that you can run multiple dispatchers (for HA) while still only processing each job once.
// (provided jobs get consistently routed to executors)
func Dispatcher(jobQueue chan<- Job) {
	go dispatchJobs(jobQueue)
	offset := time.Duration(30) * time.Second                      // for now, for simplicity, let's just wait 30seconds for the data to come in
	lastProcessed := time.Now().Truncate(time.Second).Add(-offset) // TODO: track this in a database or something so we can resume properly
	ticker := NewTicker(lastProcessed, offset, clock.New())
	for {
		select {
		case tick := <-ticker.C:
			tickQueueItems.Value(int64(len(tickQueue)))
			tickQueueSize.Value(int64(setting.TickQueueSize))

			// let's say jobs with freq 60 and offset 7 trigger at 7, 67, 127, ...
			// and offset was 30 seconds, so we query for data with last point at 37, 97, 157, ...
			// so we should find the checks where ts-30 % frequency == offset
			// and then ts-30 was a ts of the last point we should query for

			select {
			case tickQueue <- tick:
			default:
				// TODO: alert when this happens
				dispatcherTicksSkippedDueToSlowTickQueue.Inc(1)
			}
		}
	}
}

func dispatchJobs(jobQueue chan<- Job) {
	for t := range tickQueue {
		tickQueueItems.Value(int64(len(tickQueue)))
		tickQueueSize.Value(int64(setting.TickQueueSize))
		lastPointAt := t.Unix()

		pre := time.Now()
		jobs, err := getJobs(lastPointAt)
		dispatcherNumGetSchedules.Inc(1)
		dispatcherGetSchedules.Value(time.Since(pre))

		if err != nil {
			fmt.Println("CRITICAL", err) // TODO better way to log errors
			continue
		}

		dispatcherJobSchedulesSeen.Inc(int64(len(jobs)))
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

			jobQueueInternalItems.Value(int64(len(jobQueue)))
			jobQueueInternalSize.Value(int64(setting.JobQueueSize))

			select {
			case jobQueue <- *job:
			default:
				// TODO: alert when this happens
				dispatcherJobsSkippedDueToSlowJobQueue.Inc(1)
			}
			dispatcherJobsScheduled.Inc(1)
		}
	}
}
