package alerting

import (
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/services/rabbitmq"
)

type PreAMQPJobQueue struct {
	size      int
	queue     chan *Job
	publisher *rabbitmq.Publisher
}

func newPreAMQPJobQueue(size int, publisher *rabbitmq.Publisher) PreAMQPJobQueue {
	jq := PreAMQPJobQueue{
		size,
		make(chan *Job, size),
		publisher,
	}
	go jq.run()
	return jq
}

//send dispatched jobs to rabbitmq.
func (jq PreAMQPJobQueue) run() {
	for job := range jq.queue {
		routingKey := fmt.Sprintf("%d", job.MonitorId)
		msg, err := json.Marshal(job)
		if err != nil {
			log.Error(3, "failed to marshal job to json: %s", err)
			continue
		}
		jq.publisher.Publish(routingKey, msg)
	}
}

func (jq PreAMQPJobQueue) Put(job *Job) {
	jobQueuePreAMQPItems.Value(int64(len(jq.queue)))
	jobQueuePreAMQPSize.Value(int64(jq.size))

	select {
	case jq.queue <- job:
	default:
		dispatcherJobsSkippedDueToSlowJobQueuePreAMQP.Inc(1)
	}
}
