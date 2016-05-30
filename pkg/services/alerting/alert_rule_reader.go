package alerting

import (
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"sync"
	"time"
)

type RuleReader interface {
	Fetch() []m.AlertJob
}

type AlertRuleReader struct {
	serverId       string
	serverPosition int
	clusterSize    int
	mtx            sync.RWMutex
}

func NewRuleReader() *AlertRuleReader {
	rrr := &AlertRuleReader{}

	go rrr.initReader()
	return rrr
}

var (
	alertJobs []m.AlertJob
)

func (this *AlertRuleReader) initReader() {
	alertJobs = make([]m.AlertJob, 0)
	heartbeat := time.NewTicker(time.Second * 5)
	this.rr()

	for {
		select {
		case <-heartbeat.C:
			this.rr()
		}
	}
}

func (this *AlertRuleReader) rr() {
	this.mtx.Lock()
	defer this.mtx.Unlock()

	rules := make([]m.AlertRule, 0)

	/*
		rules = []m.AlertRule{
			//{Id: 1, Title: "alert rule 1", Interval: "10s", Frequency: 10},
			//{Id: 2, Title: "alert rule 2", Interval: "10s", Frequency: 10},
			//{Id: 3, Title: "alert rule 3", Interval: "10s", Frequency: 10},
			//{Id: 4, Title: "alert rule 4", Interval: "10s", Frequency: 5},
			//{Id: 5, Title: "alert rule 5", Interval: "10s", Frequency: 5},
			{
				Id:           1,
				OrgId:        1,
				Title:        "alert rule 1",
				Frequency:    3,
				DatasourceId: 1,
				WarnOperator: ">",
				WarnLevel:    3,
				CritOperator: ">",
				CritLevel:    4,
				Aggregator:   "avg",
				//Query:        `{"refId":"A","target":"statsd.fakesite.counters.session_start.*.count","textEditor":true}"`,
				Query:        `{"hide":false,"refId":"A","target":"aliasByNode(statsd.fakesite.counters.session_start.*.count, 4)","textEditor":false}`,
				QueryRange:   3600,
			},
		}
	*/

	cmd := &m.GetAlertsQuery{
		OrgId: 1,
	}
	bus.Dispatch(cmd)
	rules = cmd.Result
	//for i := this.serverPosition - 1; i < len(rules); i += this.clusterSize {

	jobs := make([]m.AlertJob, 0)
	for _, rule := range rules {
		query := &m.GetDataSourceByIdQuery{Id: rule.DatasourceId, OrgId: rule.OrgId}
		err := bus.Dispatch(query)

		if err != nil {
			continue
		}

		jobs = append(jobs, m.AlertJob{
			Rule:       rule,
			Datasource: query.Result,
		})
	}

	alertJobs = jobs
}

func (this *AlertRuleReader) Fetch() []m.AlertJob {
	return alertJobs
}

func (this *AlertRuleReader) heartBeat() {

	//Lets cheat on this until we focus on clustering
	//log.Info("Heartbeat: Sending heartbeat from " + this.serverId)
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
