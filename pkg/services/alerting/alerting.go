package alerting

import (
	"math/rand"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"sync"
)

func Init() {
	if !setting.AlertingEnabled {
		return
	}

	log.Info("Alerting: Initializing scheduler...")

	scheduler := NewScheduler()
	go scheduler.Dispatch(&AlertRuleReader{})
	go scheduler.Executor(&DummieExecutor{})
}

type Scheduler struct {
	jobs     []*AlertJob
	runQueue chan *AlertJob
	mtx      sync.RWMutex

	alertRuleFetcher RuleReader

	serverId       string
	serverPosition int
	clusterSize    int
}

func NewScheduler() *Scheduler {
	return &Scheduler{
		jobs:     make([]*AlertJob, 0),
		runQueue: make(chan *AlertJob, 1000),
		serverId: strconv.Itoa(rand.Intn(1000)),
	}
}

func (this *Scheduler) heartBeat() {
	//write heartBeat to db.
	//get the modulus position of active servers

	log.Info("Heartbeat: Sending heartbeat from " + this.serverId)
	this.clusterSize = 1
	this.serverPosition = 1
}

func (this *Scheduler) Dispatch(reader RuleReader) {
	reschedule := time.NewTicker(time.Second * 10)
	secondTicker := time.NewTicker(time.Second)
	heartbeat := time.NewTicker(time.Second * 5)

	this.heartBeat()
	this.updateJobs(reader.Fetch)

	for {
		select {
		case <-secondTicker.C:
			this.queueJobs()
		case <-reschedule.C:
			this.updateJobs(reader.Fetch)
		case <-heartbeat.C:
			this.heartBeat()
		}
	}
}

func (this *Scheduler) updateJobs(f func() []m.AlertRule) {
	log.Debug("Scheduler: UpdateJobs()")

	jobs := make([]*AlertJob, 0)
	rules := f()

	this.mtx.Lock()
	defer this.mtx.Unlock()

	for i := this.serverPosition - 1; i < len(rules); i += this.clusterSize {
		rule := rules[i]
		jobs = append(jobs, &AlertJob{
			rule:   rule,
			offset: int64(len(jobs)),
		})
	}

	log.Debug("Scheduler: Selected %d jobs", len(jobs))

	this.jobs = jobs
}

func (this *Scheduler) queueJobs() {
	now := time.Now().Unix()

	for _, job := range this.jobs {
		if now%job.rule.Frequency == 0 && job.running == false {
			log.Info("Scheduler: Putting job on to run queue: %s", job.rule.Title)
			this.runQueue <- job
		}
	}
}

func (this *Scheduler) Executor(executor Executor) {
	for job := range this.runQueue {
		log.Info("Executor: queue length %d", len(this.runQueue))
		log.Info("Executor: executing %s", job.rule.Title)
		go Measure(executor, job)
	}
}

func Measure(exec Executor, rule *AlertJob) {
	now := time.Now()
	rule.running = true
	exec.Execute(rule.rule)
	rule.running = true
	elapsed := time.Since(now)
	log.Info("Schedular: exeuction took %v milli seconds", elapsed.Nanoseconds()/1000000)
}

type AlertJob struct {
	offset  int64
	delay   bool
	running bool
	rule    m.AlertRule
}

type AlertResult struct {
	id       int64
	state    string
	duration time.Time
}
