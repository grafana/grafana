package alerting

import (
	"encoding/json"
	"fmt"

	"github.com/Dieterbe/statsd-go"
	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/services/rabbitmq"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/hashicorp/golang-lru"
	"github.com/streadway/amqp"
)

var Stat, _ = statsd.NewClient(false, "", "")

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
			Stat.Increment("alert-dispatcher.jobs-skipped-due-to-slow-jobqueue")
		}
		return nil
	})

	//start group of workers to execute the jobs in the execution channel.
	for i := 0; i < setting.Executors; i++ {
		go Executor(GraphiteAuthContextReturner, consumeQueue, cache)
	}
	return nil
}
