package alerting

import "time"

type EvalHandler interface {
	Eval(context *EvalContext)
}

type Scheduler interface {
	Tick(time time.Time, execQueue chan *Job)
	Update(rules []*Rule)
}

type Notifier interface {
	Notify(alertResult *EvalContext)
	GetType() string
	NeedsImage() bool
}

type Condition interface {
	Eval(result *EvalContext)
}
