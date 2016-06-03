package alerting

import (
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

type RuleReader interface {
	Fetch() []m.AlertRule
}

type AlertRuleReader struct {
	sync.RWMutex
	serverID       string
	serverPosition int
	clusterSize    int
}

func NewRuleReader() *AlertRuleReader {
	rrr := &AlertRuleReader{}

	go rrr.initReader()
	return rrr
}

var (
	alertJobs []m.AlertRule
)

func (arr *AlertRuleReader) Fetch() []m.AlertRule {
	return alertJobs
}

func (arr *AlertRuleReader) initReader() {
	alertJobs = make([]m.AlertRule, 0)
	heartbeat := time.NewTicker(time.Second * 10)
	arr.updateRules()

	for {
		select {
		case <-heartbeat.C:
			arr.updateRules()
		}
	}
}

func (arr *AlertRuleReader) updateRules() {
	arr.Lock()
	defer arr.Unlock()

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
	err := bus.Dispatch(cmd)

	if err == nil {
		alertJobs = cmd.Result
	}
}

func (arr *AlertRuleReader) heartBeat() {

	//Lets cheat on this until we focus on clustering
	//log.Info("Heartbeat: Sending heartbeat from " + this.serverId)
	arr.clusterSize = 1
	arr.serverPosition = 1

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
