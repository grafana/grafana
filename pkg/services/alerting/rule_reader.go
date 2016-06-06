package alerting

import (
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
)

type RuleReader interface {
	Fetch() []*AlertRule
}

type AlertRuleReader struct {
	sync.RWMutex
	serverID       string
	serverPosition int
	clusterSize    int
}

func NewRuleReader() *AlertRuleReader {
	ruleReader := &AlertRuleReader{}

	go ruleReader.initReader()
	return ruleReader
}

func (arr *AlertRuleReader) initReader() {
	heartbeat := time.NewTicker(time.Second * 10)

	for {
		select {
		case <-heartbeat.C:
			arr.heartbeat()
		}
	}
}

func (arr *AlertRuleReader) Fetch() []*AlertRule {
	cmd := &m.GetAllAlertsQuery{}
	err := bus.Dispatch(cmd)

	if err != nil {
		log.Error(1, "Alerting: ruleReader.fetch(): Could not load alerts", err)
		return []*AlertRule{}
	}

	res := make([]*AlertRule, len(cmd.Result))
	for i, ruleDef := range cmd.Result {
		model := &AlertRule{}
		model.Id = ruleDef.Id
		model.OrgId = ruleDef.OrgId
		model.DatasourceId = ruleDef.DatasourceId
		model.Query = ruleDef.Query
		model.QueryRefId = ruleDef.QueryRefId
		model.WarnLevel = ruleDef.WarnLevel
		model.WarnOperator = ruleDef.WarnOperator
		model.CritLevel = ruleDef.CritLevel
		model.CritOperator = ruleDef.CritOperator
		model.Frequency = ruleDef.Frequency
		model.Name = ruleDef.Name
		model.Description = ruleDef.Description
		model.Aggregator = ruleDef.Aggregator
		model.State = ruleDef.State
		res[i] = model
	}

	return res
}

func (arr *AlertRuleReader) heartbeat() {

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
