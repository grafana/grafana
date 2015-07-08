package alerting

import (
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/log"
	met "github.com/grafana/grafana/pkg/metric"
	"github.com/grafana/grafana/pkg/services/rabbitmq"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/hashicorp/golang-lru"
	"github.com/streadway/amqp"
)

var jobQueueInternalItems met.Gauge
var jobQueueInternalSize met.Gauge
var tickQueueItems met.Gauge
var tickQueueSize met.Gauge
var dispatcherJobsSkippedDueToSlowJobQueue met.Count
var dispatcherTicksSkippedDueToSlowTickQueue met.Count

var dispatcherGetSchedules met.Timer
var dispatcherNumGetSchedules met.Count
var dispatcherJobSchedulesSeen met.Count
var dispatcherJobsScheduled met.Count

var executorNum met.Gauge
var executorConsiderJobAlreadyDone met.Timer
var executorConsiderJobOriginalTodo met.Timer

var executorNumAlreadyDone met.Count
var executorNumOriginalTodo met.Count
var executorAlertOutcomesOk met.Count
var executorAlertOutcomesWarn met.Count
var executorAlertOutcomesCrit met.Count
var executorAlertOutcomesUnkn met.Count
var executorGraphiteEmptyResponse met.Count

var executorJobQueryGraphite met.Timer
var executorJobParseAndEval met.Timer
var executorGraphiteMissingVals met.Meter

// Init initalizes all metrics
// run this function when statsd is ready, so we can create the series
func Init(metrics met.Backend) {
	jobQueueInternalItems = metrics.NewGauge("alert-jobqueue-internal.items", 0)
	jobQueueInternalSize = metrics.NewGauge("alert-jobqueue-internal.size", int64(setting.JobQueueSize))
	tickQueueItems = metrics.NewGauge("alert-tickqueue.items", 0)
	tickQueueSize = metrics.NewGauge("alert-tickqueue.size", int64(setting.TickQueueSize))
	dispatcherJobsSkippedDueToSlowJobQueue = metrics.NewCount("alert-dispatcher.jobs-skipped-due-to-slow-jobqueue")
	dispatcherTicksSkippedDueToSlowTickQueue = metrics.NewCount("alert-dispatcher.ticks-skipped-due-to-slow-tickqueue")

	dispatcherGetSchedules = metrics.NewTimer("alert-dispatcher.get-schedules", 0)
	dispatcherNumGetSchedules = metrics.NewCount("alert-dispatcher.num-getschedules")
	dispatcherJobSchedulesSeen = metrics.NewCount("alert-dispatcher.job-schedules-seen")
	dispatcherJobsScheduled = metrics.NewCount("alert-dispatcher.jobs-scheduled")

	executorNum = metrics.NewGauge("alert-executor.num", 0)
	executorConsiderJobAlreadyDone = metrics.NewTimer("alert-executor.consider-job.already-done", 0)
	executorConsiderJobOriginalTodo = metrics.NewTimer("alert-executor.consider-job.original-todo", 0)

	executorNumAlreadyDone = metrics.NewCount("alert-executor.already-done")
	executorNumOriginalTodo = metrics.NewCount("alert-executor.original-todo")
	executorAlertOutcomesOk = metrics.NewCount("alert-executor.alert-outcomes.ok")
	executorAlertOutcomesWarn = metrics.NewCount("alert-executor.alert-outcomes.warning")
	executorAlertOutcomesCrit = metrics.NewCount("alert-executor.alert-outcomes.critical")
	executorAlertOutcomesUnkn = metrics.NewCount("alert-executor.alert-outcomes.unknown")
	executorGraphiteEmptyResponse = metrics.NewCount("alert-executor.graphite-emptyresponse")

	executorJobQueryGraphite = metrics.NewTimer("alert-executor.job_query_graphite", 0)
	executorJobParseAndEval = metrics.NewTimer("alert-executor.job_parse-and-evaluate", 0)
	executorGraphiteMissingVals = metrics.NewMeter("alert-executor.graphite-missingVals", 0)
}

func Construct() {
	cache, err := lru.New(setting.ExecutorLRUSize)
	if err != nil {
		panic(fmt.Sprintf("Can't create LRU: %s", err.Error()))
	}
	sec := setting.Cfg.Section("event_publisher")
	if sec.Key("enabled").MustBool(false) {
		//rabbitmq is enabled, let's use it for our jobs.
		url := sec.Key("rabbitmq_url").String()
		if err := distributed(url, cache); err != nil {
			log.Fatal(0, "failed to start amqp consumer.", err)
		}
		return
	} else {
		if !setting.EnableScheduler {
			log.Fatal(0, "Alerting in standalone mode requires a scheduler (enable_scheduler = true)")
		}
		if setting.Executors == 0 {
			log.Fatal(0, "Alerting in standalone mode requires at least 1 executor (try: executors = 10)")
		}

		standalone(cache)
	}
}

func standalone(cache *lru.Cache) {
	jobQueue := make(chan Job, setting.JobQueueSize)

	// start dispatcher.
	// at some point we'll support rabbitmq or something so we can have multiple grafana dispatchers and executors.
	// to allow that we would use two queues. The dispatch would write to one, and the executor would read from another.
	// another thread would then handle useing rabbitmq as an intermediary between the two.
	go Dispatcher(jobQueue)

	//start group of workers to execute the checks.
	for i := 0; i < setting.Executors; i++ {
		go Executor(GraphiteAuthContextReturner, jobQueue, cache)
	}
}

func distributed(url string, cache *lru.Cache) error {
	exchange := "alertingJobs"
	exch := rabbitmq.Exchange{
		Name:         exchange,
		ExchangeType: "x-consistent-hash",
		Durable:      true,
	}

	if setting.EnableScheduler {
		publisher := &rabbitmq.Publisher{Url: url, Exchange: &exch}
		err := publisher.Connect()
		if err != nil {
			return err
		}
		jobQueue := make(chan Job, setting.JobQueueSize)

		go Dispatcher(jobQueue)

		//send dispatched jobs to rabbitmq.
		go func(jobQueue <-chan Job) {
			for job := range jobQueue {
				routingKey := fmt.Sprintf("%d", job.MonitorId)
				msg, err := json.Marshal(job)
				//log.Info("sending: " + string(msg))
				if err != nil {
					log.Error(3, "failed to marshal job to json.", err)
					continue
				}
				publisher.Publish(routingKey, msg)
			}
		}(jobQueue)
	}

	if setting.Executors > 0 {
		q := rabbitmq.Queue{
			Name:       "",
			Durable:    false,
			AutoDelete: true,
			Exclusive:  true,
		}
		consumer := rabbitmq.Consumer{
			Url:        url,
			Exchange:   &exch,
			Queue:      &q,
			BindingKey: []string{"10"}, //consistant hashing weight.
		}
		if err := consumer.Connect(); err != nil {
			log.Fatal(0, "failed to start event.consumer.", err)
		}

		consumeQueue := make(chan Job, setting.JobQueueSize)

		//read jobs from rabbitmq and push them into the execution channel.
		consumer.Consume(func(msg *amqp.Delivery) error {
			//convert from json to Job
			job := Job{}
			//log.Info("recvd: " + string(msg.Body))
			if err := json.Unmarshal(msg.Body, &job); err != nil {
				log.Error(0, "failed to unmarshal msg body.", err)
				return err
			}
			job.StoreMetricFunc = api.StoreMetric
			select {
			case consumeQueue <- job:
			default:
				// TODO: alert when this happens
				dispatcherJobsSkippedDueToSlowJobQueue.Inc(1)
			}
			return nil
		})

		//start group of workers to execute the jobs in the execution channel.
		for i := 0; i < setting.Executors; i++ {
			go Executor(GraphiteAuthContextReturner, consumeQueue, cache)
		}
	}
	return nil
}
