package clustering

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/setting"
	"golang.org/x/sync/errgroup"
)

type ClusterManager struct {
	clusterNodeMgmt      ClusterNodeMgmt
	ticker               *alerting.Ticker // using the ticker from alerting package for now. Should move the impl outside alerting later
	log                  log.Logger
	alertingState        *AlertingState
	dispatcherTaskQ      chan *DispatcherTask
	dispatcherTaskStatus chan *DispatcherTaskStatus
}

const (
	DISPATCHER_TASK_TYPE_ALERTS_MISSING   = iota
	DISPATCHER_TASK_TYPE_ALERTS_PARTITION = iota
)

type DispatcherTaskStatus struct {
	taskType int
	success  bool
	errmsg   string
}
type DispatcherTask struct {
	taskType int
	taskInfo interface{}
}

type DispatcherTaskAlertsMissing struct {
	//TODO
}
type DispatcherTaskAlertsPartition struct {
	partId    int
	nodeCount int
	interval  int64
}

type AlertingState struct {
	status                string
	run_type              string
	lastProcessedInterval int64
}

func NewClusterManager() *ClusterManager {
	cm := &ClusterManager{
		clusterNodeMgmt: getClusterNode(),
		ticker:          alerting.NewTicker(time.Now(), time.Second*0, clock.New()),
		log:             log.New("clustering.clusterManager"),
		alertingState: &AlertingState{
			status:                m.CLN_ALERT_STATUS_OFF,
			lastProcessedInterval: 0,
			run_type:              m.CLN_ALERT_RUN_TYPE_NORMAL,
		},
		dispatcherTaskQ:      make(chan *DispatcherTask, 1),
		dispatcherTaskStatus: make(chan *DispatcherTaskStatus, 1),
	}
	return cm
}

func (cm *ClusterManager) Run(parentCtx context.Context) error {
	cm.log.Info("Initializing cluster manager")
	var reterr error = nil
	taskGroup, ctx := errgroup.WithContext(parentCtx)
	taskGroup.Go(func() error { return cm.clusterMgrTicker(ctx) })
	taskGroup.Go(func() error { return cm.alertRulesDispatcher(ctx) })

	if reterr := taskGroup.Wait(); reterr != nil {
		msg := "Cluster manager stopped"
		cm.log.Info(msg, "reason", reterr)
	}

	cm.log.Info("Cluster manager has terminated")
	return reterr
}

func (cm *ClusterManager) clusterMgrTicker(ctx context.Context) error {
	defer func() {
		if err := recover(); err != nil {
			cm.log.Error("Panic: stopping clusterMgrTicker", "error", err, "stack", log.Stack(1))
		}
	}()
	cm.log.Info("clusterMgrTicker started")
	ticksCounter := 0
	for {
		select {
		case <-ctx.Done():
			cm.log.Info("clusterMgrTicker Done")
			return ctx.Err()
		case <-cm.ticker.C: // ticks every second
			if ticksCounter%60 == 0 {
				//checkin() will happen only after every 1 minute. So it will enter alert_state = processing/scehduling
				//and alert_runType = missing/normal whatever is the situtaion at that time. But missing alert
				//checkin() has to happen after normal alert processing is done and missing alert processing starts
				//so that mutliple nodes don't execute missing alerts.
				cm.clusterNodeMgmt.CheckIn(cm.alertingState)
			}
			if ticksCounter%10 == 0 {
				if setting.AlertingEnabled && setting.ExecuteAlerts {
					cm.alertsScheduler()
				}
			}
			ticksCounter++
		case taskStatus := <-cm.dispatcherTaskStatus:
			cm.handleDispatcherTaskStatus(taskStatus)
		}
	}
}

func (cm *ClusterManager) handleDispatcherTaskStatus(taskStatus *DispatcherTaskStatus) {
	if taskStatus.taskType == DISPATCHER_TASK_TYPE_ALERTS_MISSING ||
		taskStatus.taskType == DISPATCHER_TASK_TYPE_ALERTS_PARTITION {
		if taskStatus.success {
			cm.changeAlertingState(m.CLN_ALERT_STATUS_PROCESSING)
		} else {
			cm.log.Error("Failed to dispatch task", "error", taskStatus.errmsg)
			cm.changeAlertingState(m.CLN_ALERT_STATUS_READY)
		}
	} else {
		cm.log.Error("Status received on unsupported task type "+string(taskStatus.taskType),
			"status", taskStatus.success, "error", taskStatus.errmsg)
	}
}

func (cm *ClusterManager) alertsScheduler() {
	if cm.alertingState.status == m.CLN_ALERT_STATUS_SCHEDULING ||
		(cm.alertingState.status == m.CLN_ALERT_STATUS_PROCESSING && cm.hasPendingAlertJobs()) {
		return
	}
	if cm.alertingState.status != m.CLN_ALERT_STATUS_READY {
		cm.changeAlertingState(m.CLN_ALERT_STATUS_READY)
	}
	cm.scheduleNormalAlerts()
	hasNode, err := cm.isAnyOtherNodeProcessingMissingAlerts()
	if err != nil {
		return
	}
	if !hasNode {
		cm.scheduleMissingAlerts()
	}
}

func (cm *ClusterManager) hasPendingAlertJobs() bool {
	jobCountQuery := &alerting.PendingAlertJobCountQuery{}
	err := bus.Dispatch(jobCountQuery)
	if err != nil {
		panic(fmt.Sprintf("Failed to get pending alert job count. Error: %v", err))
	}
	cm.log.Debug("Cluster manager ticker - pending alert jobs", "count", jobCountQuery.ResultCount)
	return jobCountQuery.ResultCount > 0
}

func (cm *ClusterManager) isAnyOtherNodeProcessingMissingAlerts() (bool, error) {
	cm.log.Debug("Cluster manager ticker - check if any other node is processing missing alerts")
	cmd := &m.GetNodeProcessingMissingAlertsCommand{}
	if err := bus.Dispatch(cmd); err != nil {
		cm.log.Error("Failed to check if any other node is processing missing alerts", "error", err)
		return false, err
	}
	if cmd.Result != nil {
		return true, nil
	}
	return false, nil
}

func (cm *ClusterManager) scheduleMissingAlerts() {
	lastHeartbeat, err := cm.clusterNodeMgmt.GetLastHeartbeat()
	if err != nil {
		cm.log.Error("Failed to get last heartbeat", "error", err)
		return
	}
	if lastHeartbeat <= cm.alertingState.lastProcessedInterval {
		return
	}
	activeNode, err := cm.clusterNodeMgmt.GetNode(lastHeartbeat)
	if err != nil {
		cm.log.Debug("Failed to get node for heartbeat "+strconv.FormatInt(lastHeartbeat, 10), "error", err, "activeNode", activeNode.NodeId)
		return
	}
	cm.changeAlertingStateAndRunType(m.CLN_ALERT_STATUS_SCHEDULING, m.CLN_ALERT_RUN_TYPE_MISSING)
	alertDispatchTask := &DispatcherTask{
		taskType: DISPATCHER_TASK_TYPE_ALERTS_MISSING,
	}
	cm.dispatcherTaskQ <- alertDispatchTask
	cm.alertingState.lastProcessedInterval = lastHeartbeat
}

func (cm *ClusterManager) scheduleNormalAlerts() {
	lastHeartbeat, err := cm.clusterNodeMgmt.GetLastHeartbeat()
	if err != nil {
		cm.log.Error("Failed to get last heartbeat", "error", err)
		return
	}
	if lastHeartbeat <= cm.alertingState.lastProcessedInterval {
		return
	}
	activeNode, err := cm.clusterNodeMgmt.GetNode(lastHeartbeat)
	if err != nil {
		cm.log.Debug("Failed to get node for heartbeat "+strconv.FormatInt(lastHeartbeat, 10), "error", err)
		return
	}
	if activeNode.AlertStatus != m.CLN_ALERT_STATUS_READY {
		cm.log.Debug(fmt.Sprintf("This node %v is not scheduled to process interval %v (status=%v)",
			activeNode.NodeId, lastHeartbeat, activeNode.AlertStatus))
		return
	}
	nodeCount, err := cm.clusterNodeMgmt.GetActiveNodesCount(lastHeartbeat)
	if err != nil {
		cm.log.Error("Failed to get active node count for heartbeat "+string(lastHeartbeat), "error", err)
		return
	}
	if nodeCount == 0 {
		cm.log.Warn("Found node count 0")
		return
	}

	cm.changeAlertingStateAndRunType(m.CLN_ALERT_STATUS_SCHEDULING, m.CLN_ALERT_RUN_TYPE_NORMAL)
	alertDispatchTask := &DispatcherTask{
		taskType: DISPATCHER_TASK_TYPE_ALERTS_PARTITION,
		taskInfo: &DispatcherTaskAlertsPartition{
			interval:  lastHeartbeat,
			nodeCount: nodeCount,
			partId:    int(activeNode.PartId),
		},
	}
	cm.dispatcherTaskQ <- alertDispatchTask
	cm.alertingState.lastProcessedInterval = lastHeartbeat
}

func (cm *ClusterManager) alertRulesDispatcher(ctx context.Context) error {
	defer func() {
		if err := recover(); err != nil {
			cm.log.Error("Panic: stopping alertRulesDispatcher", "error", err, "stack", log.Stack(1))
		}
	}()
	cm.log.Info("alertRulesDispatcher started")
	for {
		select {
		case <-ctx.Done():
			cm.log.Info("alertRulesDispatcher Done")
			return ctx.Err()
		case task := <-cm.dispatcherTaskQ:
			cm.handleAlertRulesDispatcherTask(task)
		}
	}
}

func (cm *ClusterManager) handleAlertRulesDispatcherTask(task *DispatcherTask) {
	var err error = nil
	switch task.taskType {
	case DISPATCHER_TASK_TYPE_ALERTS_PARTITION:
		taskInfo := task.taskInfo.(*DispatcherTaskAlertsPartition)
		scheduleCmd := &alerting.ScheduleAlertsForPartitionCommand{
			Interval:  taskInfo.interval,
			NodeCount: taskInfo.nodeCount,
			PartId:    taskInfo.partId,
		}
		err = bus.Dispatch(scheduleCmd)
		cm.log.Debug("Alert rules dispatcher - submitted next alerts batch")
	case DISPATCHER_TASK_TYPE_ALERTS_MISSING:
		scheduleCmd := &alerting.ScheduleMissingAlertsCommand{}
		err = bus.Dispatch(scheduleCmd)
		cm.log.Debug("Alert rules dispatcher - submitted missing alerts batch")
	default:
		err = errors.New("Invalid task type " + string(task.taskType))
		cm.log.Error(err.Error())
	}
	if err != nil {
		cm.dispatcherTaskStatus <- &DispatcherTaskStatus{task.taskType, false, err.Error()}
	} else {
		cm.dispatcherTaskStatus <- &DispatcherTaskStatus{task.taskType, true, ""}
	}
}

func (cm *ClusterManager) changeAlertingState(newState string) {
	cm.log.Info("Alerting state: " + cm.alertingState.status + " -> " + newState)
	cm.alertingState.status = newState
}

func (cm *ClusterManager) changeAlertRunType(runType string) {
	cm.alertingState.run_type = runType
}

func (cm *ClusterManager) changeAlertingStateAndRunType(newState string, runType string) {
	cm.changeAlertingState(newState)
	cm.changeAlertRunType(runType)
}
