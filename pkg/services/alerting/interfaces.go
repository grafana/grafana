package alerting

import (
	"time"

	"github.com/grafana/grafana/pkg/tsdb"
)

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
	Reduce(timeSeries *tsdb.TimeSeries) float64
}

type AlertEvaluator interface {
	Eval(timeSeries *tsdb.TimeSeries, reducedValue float64) bool
}
