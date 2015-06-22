package alerting

import (
	"encoding/json"
	"fmt"
	"github.com/Dieterbe/statsd-go"
	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/services/rabbitmq"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/streadway/amqp"
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
	s, err := statsd.NewClient(setting.StatsdEnabled, setting.StatsdAddr, "grafana.")
	if err != nil {
		log.Error(3, "Statsd client:", err)
	}
	Stat = s

	sec := setting.Cfg.Section("event_publisher")
	if sec.Key("enabled").MustBool(false) {
		//rabbitmq is enabled, lets us it for our jobs.
		url := sec.Key("rabbitmq_url").String()
		if err := distributed(url); err != nil {
			log.Fatal(0, "failed to start amqp consumer.", err)
		}
		return
	} else {
		standalone()
	}
}

func setStatsdClient(s *statsd.Client) {
	Stat = s
}

func standalone() {
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

func distributed(url string) error {
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
	jobQueue := make(chan Job, jobQueueSize)

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

	consumeQueue := make(chan Job, jobQueueSize)

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
	for i := 0; i < 10; i++ {
		go Executor(GraphiteAuthContextReturner, consumeQueue)
	}
	return nil
}
