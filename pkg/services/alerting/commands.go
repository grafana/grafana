package alerting

import (
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

type UpdateDashboardAlertsCommand struct {
	UserId    int64
	OrgId     int64
	Dashboard *m.Dashboard
}

type ValidateDashboardAlertsCommand struct {
	UserId    int64
	OrgId     int64
	Dashboard *m.Dashboard
}

type PendingAlertJobCountQuery struct {
	ResultCount int
}

type ScheduleAlertsForPartitionCommand struct {
	PartId    int
	NodeCount int
	Interval  int64
}

type ScheduleMissingAlertsCommand struct {
	MissingAlerts []*m.Alert
	Result        []*Rule
}

func init() {
	bus.AddHandler("alerting", updateDashboardAlerts)
	bus.AddHandler("alerting", validateDashboardAlerts)
	bus.AddHandler("alerting", getPendingAlertJobCount)
	bus.AddHandler("alerting", scheduleAlertsForPartition)
	bus.AddHandler("alerting", scheduleMissingAlerts)
}

func validateDashboardAlerts(cmd *ValidateDashboardAlertsCommand) error {
	extractor := NewDashAlertExtractor(cmd.Dashboard, cmd.OrgId)

	if _, err := extractor.GetAlerts(); err != nil {
		return err
	}

	return nil
}

func updateDashboardAlerts(cmd *UpdateDashboardAlertsCommand) error {
	saveAlerts := m.SaveAlertsCommand{
		OrgId:       cmd.OrgId,
		UserId:      cmd.UserId,
		DashboardId: cmd.Dashboard.Id,
	}

	extractor := NewDashAlertExtractor(cmd.Dashboard, cmd.OrgId)

	if alerts, err := extractor.GetAlerts(); err != nil {
		return err
	} else {
		saveAlerts.Alerts = alerts
	}

	if err := bus.Dispatch(&saveAlerts); err != nil {
		return err
	}

	return nil
}

func getPendingAlertJobCount(query *PendingAlertJobCountQuery) error {
	if engine == nil {
		return errors.New("Alerting engine is not initialized")
	}
	query.ResultCount = len(engine.execQueue)
	return nil
}

func scheduleAlertsForPartition(cmd *ScheduleAlertsForPartitionCommand) error {
	if engine == nil {
		return errors.New("Alerting engine is not initialized")
	}
	if cmd.NodeCount == 0 {
		return errors.New("Node count is 0")
	}
	if cmd.PartId >= cmd.NodeCount {
		return errors.New(fmt.Sprintf("Invalid partition id %v (node count = %v)", cmd.PartId, cmd.NodeCount))
	}
	rules := engine.ruleReader.Fetch()
	filterCount := 0
	intervalEnd := time.Unix(cmd.Interval, 0).Add(time.Minute)
	for _, rule := range rules {
		// handle frequency greater than 1 min
		nextEvalDate := rule.EvalDate.Add(time.Duration(rule.Frequency) * time.Second)
		if nextEvalDate.Before(intervalEnd) {
			if rule.Id%int64(cmd.NodeCount) == int64(cmd.PartId) {
				engine.execQueue <- &Job{Rule: rule}
				filterCount++
				engine.log.Debug(fmt.Sprintf("Scheduled Rule : %v for interval=%v", rule, cmd.Interval))
			} else {
				engine.log.Debug(fmt.Sprintf("Skipped Rule : %v for interval=%v, partition id=%v, nodeCount=%v", rule, cmd.Interval, cmd.PartId, cmd.NodeCount))
			}
		} else {
			engine.log.Debug(fmt.Sprintf("Skipped Rule : %v for interval=%v, intervalEnd=%v, nextEvalDate=%v", rule, cmd.Interval, intervalEnd, nextEvalDate))
		}
	}
	engine.log.Info(fmt.Sprintf("%v/%v rules scheduled for execution for partition %v/%v",
		filterCount, len(rules), cmd.PartId, cmd.NodeCount))
	return nil
}

func scheduleMissingAlerts(cmd *ScheduleMissingAlertsCommand) error {
	//transform each alert to rule
	res := make([]*Rule, 0)
	missingAlerts := cmd.MissingAlerts
	for _, ruleDef := range missingAlerts {
		if model, err := NewRuleFromDBAlert(ruleDef); err != nil {
			engine.log.Error("Could not build alert model for rule", "ruleId", ruleDef.Id, "error", err)
		} else {
			res = append(res, model)
			engine.execQueue <- &Job{Rule: model}
			engine.log.Debug(fmt.Sprintf("Scheduled missed Rule : %v", model.Name))
		}
	}
	cmd.Result = res
	engine.log.Info(fmt.Sprintf("Total no of rules scheduled for execution of missed alerts is %v", len(missingAlerts)))
	return nil
}
