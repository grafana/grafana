package controller

import "k8s.io/client-go/util/workqueue"

// newWorkerQueue places enqueue tracking below the delay scheduler, so AddAfter
// and AddRateLimited start their wait only when the item enters the workqueue.
func newWorkerQueue(lag *queueLagTracker, limiter workqueue.TypedRateLimiter[string], config workqueue.TypedQueueConfig[string]) workqueue.TypedRateLimitingInterface[string] {
	queue := &lagTrackingQueue{
		TypedInterface: workqueue.NewTypedWithConfig(config),
		lag:            lag,
	}
	delayingQueue := workqueue.NewTypedDelayingQueueWithConfig(workqueue.TypedDelayingQueueConfig[string]{
		Name:            config.Name,
		MetricsProvider: config.MetricsProvider,
		Clock:           config.Clock,
		Queue:           queue,
	})
	return workqueue.NewTypedRateLimitingQueueWithConfig(limiter, workqueue.TypedRateLimitingQueueConfig[string]{
		DelayingQueue: delayingQueue,
	})
}

type lagTrackingQueue struct {
	workqueue.TypedInterface[string]
	lag *queueLagTracker
}

func (q *lagTrackingQueue) Add(key string) {
	if q.ShuttingDown() {
		return
	}
	// Stamp before Add can wake a worker that immediately picks up the key.
	q.lag.add(key)
	q.TypedInterface.Add(key)
}
