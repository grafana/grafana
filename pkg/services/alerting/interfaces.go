package alerting

import "time"

type Executor interface {
	Execute(rule *AlertJob, resultChan chan *AlertResult)
}

type Scheduler interface {
	Tick(time time.Time, execQueue chan *AlertJob)
	Update(rules []AlertRule)
}
