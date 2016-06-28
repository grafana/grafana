package alerting

import "time"

type AlertingHandler interface {
	Execute(rule *AlertJob, resultChan chan *AlertResult)
}

type Scheduler interface {
	Tick(time time.Time, execQueue chan *AlertJob)
	Update(rules []*AlertRule)
}

type Notifier interface {
	Notify(alertResult *AlertResult)
}
