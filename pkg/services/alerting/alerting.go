package alerting

import (
	"math/rand"
	"strconv"
	"time"

	//"github.com/grafana/grafana/pkg/bus"
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
	go scheduler.HandleResponses()
}

type Scheduler struct {
	jobs          map[int64]*AlertJob
	runQueue      chan *AlertJob
	responseQueue chan *AlertResult
	mtx           sync.RWMutex

	alertRuleFetcher RuleReader

	serverId       string
	serverPosition int
	clusterSize    int
}

func NewScheduler() *Scheduler {
	return &Scheduler{
		jobs:          make(map[int64]*AlertJob, 0),
		runQueue:      make(chan *AlertJob, 1000),
		responseQueue: make(chan *AlertResult, 1000),
		serverId:      strconv.Itoa(rand.Intn(1000)),
	}
}

func (this *Scheduler) heartBeat() {

	//Lets cheat on this until we focus on clustering
	log.Info("Heartbeat: Sending heartbeat from " + this.serverId)
	this.clusterSize = 1
	this.serverPosition = 1

	/*
		cmd := &m.HeartBeatCommand{ServerId: this.serverId}
		err := bus.Dispatch(cmd)

		if err != nil {
			log.Error(1, "Failed to send heartbeat.")
		} else {
			this.clusterSize = cmd.Result.ClusterSize
			this.serverPosition = cmd.Result.UptimePosition
		}
	*/
}

func (this *Scheduler) Dispatch(reader RuleReader) {
	reschedule := time.NewTicker(time.Second * 100)
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

	jobs := make(map[int64]*AlertJob, 0)
	rules := f()

	this.mtx.Lock()
	defer this.mtx.Unlock()

	for i := this.serverPosition - 1; i < len(rules); i += this.clusterSize {
		rule := rules[i]
		jobs[rule.Id] = &AlertJob{rule: rule, offset: int64(len(jobs))}
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
		this.jobs[job.rule.Id].running = true
		go this.Measure(executor, job)
	}
}

func (this *Scheduler) HandleResponses() {
	for response := range this.responseQueue {
		log.Info("Response: alert %d returned %s", response.id, response.state)
		this.jobs[response.id].running = false
	}
}

func (this *Scheduler) Measure(exec Executor, rule *AlertJob) {
	now := time.Now()
	exec.Execute(rule.rule, this.responseQueue)
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
