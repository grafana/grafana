package alerting

import "time"

type AlertHandler interface {
	Execute(rule *AlertRule, resultChan chan *AlertResultContext)
}

type Scheduler interface {
	Tick(time time.Time, execQueue chan *AlertJob)
	Update(rules []*AlertRule)
}

type Notifier interface {
	Notify(alertResult *AlertResultContext)
}

type AlertCondition interface {
	Eval(result *AlertResultContext)
}

type QueryReducer interface {
	Reduce() float64
}

type AlertEvaluator interface {
	Eval() bool
}
