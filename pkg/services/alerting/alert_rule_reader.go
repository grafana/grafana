package alerting

import (
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
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

	cmd := &m.GetAlertsQuery{
		OrgId: 1,
	}
	err := bus.Dispatch(cmd)

	if err == nil {
		alertJobs = cmd.Result
	} else {
		log.Error(1, "AlertRuleReader: Could not load alerts")
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
