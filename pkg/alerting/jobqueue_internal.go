package alerting

type internalJobQueue struct {
	size  int
	queue chan *Job
}

func newInternalJobQueue(size int) internalJobQueue {
	return internalJobQueue{
		size,
		make(chan *Job, size),
	}
}

func (jq internalJobQueue) Put(job *Job) {
	jobQueueInternalItems.Value(int64(len(jq.queue)))
	jobQueueInternalSize.Value(int64(jq.size))

	select {
	case jq.queue <- job:
	default:
		dispatcherJobsSkippedDueToSlowJobQueueInternal.Inc(1)
	}
}
