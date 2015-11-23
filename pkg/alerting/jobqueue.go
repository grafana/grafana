package alerting

type JobQueue interface {
	Put(job *Job)
}
