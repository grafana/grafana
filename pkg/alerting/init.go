package alerting

import (
	"fmt"
	"github.com/Dieterbe/statsd-go"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/log"
)

var Stat *statsd.Client

// this should be set to above the max amount of jobs you expect to ever be created in 1 shot
// so we can queue them all at once and then workers can process them
// if more than this amount of jobs queue up, it means the workers can't process fast enough,
// and the jobs will be skipped.
// TODO configurable
var jobQueueSize = 1000

func Init() {
	fmt.Println("statsdclient enabled=", setting.StatsdEnabled, "addr", setting.StatsdAddr)
	s, err := statsd.NewClient(setting.StatsdEnabled, setting.StatsdAddr, "grafana")
	if err != nil {
		log.Error(3, "Statsd client:", err)
	}
	Stat = s

	jobQueue := make(chan Job, jobQueueSize)

	// start dispatcher.
	// at some point we'll support rabbitmq or something so we can have multiple grafana dispatchers and executors.
	// to allow that we would use two queues. The dispatch would write to one, and the executor would read from another.
	// another thread would then handle useing rabbitmq as an intermediary between the two.
	go Dispatcher(jobQueue)

	//start group of workers to execute the checks.
	for i := 0; i < 10; i++ {
		go Executor(GraphiteAuthContextReturner, jobQueue)
	}
}
