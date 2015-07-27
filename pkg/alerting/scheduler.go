package alerting

import (
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/setting"
)

// this channel decouples the secondly tick from the dispatching (which is mainly database querying)
// so that temporarily database hickups don't block the ticker.
var tickQueue = make(chan time.Time, setting.TickQueueSize)

// Dispatcher dispatches, every second, all jobs that should run for that second
// every job has an id so that you can run multiple dispatchers (for HA) while still only processing each job once.
// (provided jobs get consistently routed to executors)
func Dispatcher(jobQueue JobQueue) {
	go dispatchJobs(jobQueue)
	offset := time.Duration(LoadOrSetOffset()) * time.Second
	// no need to try resuming where we left off in the past.
	// see https://github.com/raintank/grafana/issues/266
	lastProcessed := time.Now().Truncate(time.Second).Add(-offset)
	cl := clock.New()
	ticker := NewTicker(lastProcessed, offset, cl)
	go func() {
		offsetReadTicker := cl.Ticker(time.Duration(1) * time.Second)
		for range offsetReadTicker.C {
			offset := time.Duration(LoadOrSetOffset()) * time.Second
			ticker.updateOffset(offset)
		}
	}()
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
				dispatcherTicksSkippedDueToSlowTickQueue.Inc(1)
			}
		}
	}
}

func dispatchJobs(jobQueue JobQueue) {
	for lastPointAt := range tickQueue {
		tickQueueItems.Value(int64(len(tickQueue)))
		tickQueueSize.Value(int64(setting.TickQueueSize))

		pre := time.Now()
		jobs, err := getJobs(lastPointAt.Unix())
		dispatcherNumGetSchedules.Inc(1)
		dispatcherGetSchedules.Value(time.Since(pre))

		if err != nil {
			log.Error(0, "getJobs() failed: %q", err)
			continue
		}

		dispatcherJobSchedulesSeen.Inc(int64(len(jobs)))
		for _, job := range jobs {
			job.GeneratedAt = time.Now()
			job.LastPointTs = lastPointAt

			jobQueue.Put(job)

			dispatcherJobsScheduled.Inc(1)
		}
	}
}
