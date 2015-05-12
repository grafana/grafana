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
	Definition CheckDef
	ts         time.Time // sets an explicit "until" to match the data this alert run is meant for, even when execution is delayed
}

func (job Job) String() string {
	return fmt.Sprintf("<Job> key=%s time=%s definition: %s", job.key, job.ts, job.Definition)
}

var queue = make(chan Job) // TODO: use rabbitmq or something so we can have multiple grafana dispatchers and executors. also make buffer configurable and expose number as metric
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
			fmt.Println("attempting dispatch", t)
			select {
			case dispatch <- t:
			default:
				panic(fmt.Sprintf("dispatchJobs() can't keep up with clock. database too slow?"))
			}
		}
	}
}

func dispatchJobs() {
	for t := range dispatch {
		normalizedTime := t.Unix()
		fmt.Println(t, "querying for jobs that should run in second", normalizedTime)
		schedules, err := getSchedules()
		if err != nil {
			fmt.Println("CRITICAL", err) // TODO better way to log errors
			continue
		}
		for _, sched := range schedules {
			job := Job{
				fmt.Sprintf("alert-id_%d", normalizedTime),
				sched.Definition,
				t,
			}
			select {
			case queue <- job:
			default:
				panic(fmt.Sprintf("job queue() can't keep up with dispatched jobs. workers not processing fast enough"))
			}
		}
		// TODO probably the queries run by getschedule should get datasource, but if not, add in proper datasource like so
		// func (check *Check) getDataSource() {
		//  dsQuery := m.GetDataSourceByIdQuery{Id: check.Id}
		//
		//  if err := bus.Dispatch(&dsQuery); err != nil {
		//      return nil, err
		//  }
		//
		//  return dsQuery.Result
		// }

	}
}
