package clustering

import (
	"context"
	"errors"
	"strconv"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"golang.org/x/sync/errgroup"
)

type ClusterManager struct {
	clusterNodeMgmt      ClusterNodeMgmt
	ticker               *alerting.Ticker // using the ticker from alerting package for now. Should move the impl outside alerting later
	log                  log.Logger
	alertEngine          *alerting.Engine
	alertingState        *AlertingState
	dispatcherTaskQ      chan *DispatcherTask
	dispatcherTaskStatus chan *DispatcherTaskStatus
}

const (
	DISPATCHER_TASK_TYPE_ALERTS_MISSING   = iota
	DISPATCHER_TASK_TYPE_ALERTS_PARTITION = iota
)

type DispatcherTaskStatus struct {
	success bool
	errmsg  string
}
type DispatcherTask struct {
	taskType int
	taskInfo interface{}
}

type DispatcherTaskAlertsMissing struct {
	//TODO
}
type DispatcherTaskAlertsPartition struct {
	partitionNo int
	nodeCount   int
	interval    int64
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
			status:                m.CLN_ALERT_STATUS_READY,
			lastProcessedInterval: 0,
			run_type:              m.CLN_ALERT_RUN_TYPE_NORMAL,
		},
		dispatcherTaskQ:      make(chan *DispatcherTask, 1),
		dispatcherTaskStatus: make(chan *DispatcherTaskStatus, 1),
	}
	return cm
}

func (cm *ClusterManager) SetAlertEngine(alertEngine *alerting.Engine) {
	cm.alertEngine = alertEngine
}
func (cm *ClusterManager) Run(parentCtx context.Context) error {
	cm.log.Info("Initializing cluster manager")
	var reterr error = nil
	taskGroup, ctx := errgroup.WithContext(parentCtx)
	taskGroup.Go(func() error { return cm.clusterMgrTicker(ctx) })
	taskGroup.Go(func() error { return cm.alertRulesDispatcher(ctx) })

	if reterr := taskGroup.Wait(); reterr != nil {
		errmsg := "Cluster manager stopped with error"
		cm.log.Error(errmsg, "reason", reterr)
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

	ticksCounter := 0
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case tick := <-cm.ticker.C: // ticks every second
			if ticksCounter%10 == 0 {
				cm.alertsScheduler(tick, ticksCounter)
			}
			if ticksCounter%60 == 0 {
				cm.clusterNodeMgmt.CheckIn(cm.alertingState)
			}
			ticksCounter++
		case taskStatus := <-cm.dispatcherTaskStatus:
			if taskStatus.success {
				cm.changeAlertingState(m.CLN_ALERT_STATUS_PROCESSING)
			} else {
				cm.log.Error("Failed to dispatch task", "error", taskStatus.errmsg)
				cm.changeAlertingState(m.CLN_ALERT_STATUS_READY)
			}
		}

	}
}

func (cm *ClusterManager) alertsScheduler(tick time.Time, ticksCounter int) {
	if cm.alertingState.status == m.CLN_ALERT_STATUS_SCHEDULING ||
		(cm.alertingState.status == m.CLN_ALERT_STATUS_PROCESSING && cm.hasPendingAlertJobs()) {
		return
	}
	if cm.alertingState.status != m.CLN_ALERT_STATUS_READY {
		cm.changeAlertingState(m.CLN_ALERT_STATUS_READY)
	}
	if cm.checkMissingAlerts() {
		cm.scheduleMissingAlerts()
	} else {
		cm.scheduleNormalAlerts()
	}
}

func (cm *ClusterManager) hasPendingAlertJobs() bool {
	jobCount := cm.alertEngine.GetPendingJobCount()
	cm.log.Debug("Cluster manager ticker - pending alert jobs", "count", jobCount)
	return jobCount > 0
}

func (cm *ClusterManager) checkMissingAlerts() bool {
	cm.log.Debug("Cluster manager ticker - check missing alerts")
	//TODO
	return false
}

func (cm *ClusterManager) scheduleMissingAlerts() {
	cm.log.Debug("Cluster manager ticker - process missing alerts")
	//TODO
}

func (cm *ClusterManager) scheduleNormalAlerts() {
	lastHeartbeat, err := cm.clusterNodeMgmt.GetLastHeartbeat()
	if err != nil {
		cm.log.Error("Failed to get last heartbeat", "error", err)
		return
	}
	activeNode, err := cm.clusterNodeMgmt.GetNode(lastHeartbeat)
	if err != nil {
		cm.log.Error("Failed to get node for heartbeat "+strconv.FormatInt(lastHeartbeat, 10), "error", err)
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
	if lastHeartbeat > cm.alertingState.lastProcessedInterval {
		cm.changeAlertingState(m.CLN_ALERT_STATUS_SCHEDULING)
		alertDispatchTask := &DispatcherTask{
			taskType: DISPATCHER_TASK_TYPE_ALERTS_PARTITION,
			taskInfo: &DispatcherTaskAlertsPartition{
				interval:    lastHeartbeat,
				nodeCount:   nodeCount,
				partitionNo: int(activeNode.PartitionNo),
			},
		}
		cm.dispatcherTaskQ <- alertDispatchTask
		cm.alertingState.lastProcessedInterval = lastHeartbeat
	}
}

func (cm *ClusterManager) alertRulesDispatcher(ctx context.Context) error {
	defer func() {
		if err := recover(); err != nil {
			cm.log.Error("Panic: stopping alertRulesDispatcher", "error", err, "stack", log.Stack(1))
		}
	}()
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case task := <-cm.dispatcherTaskQ:
			err := cm.handleAlertRulesDispatcherTask(task)
			if err != nil {
				cm.dispatcherTaskStatus <- &DispatcherTaskStatus{false, err.Error()}
			} else {
				cm.dispatcherTaskStatus <- &DispatcherTaskStatus{true, ""}
			}
		}
	}
}

func (cm *ClusterManager) handleAlertRulesDispatcherTask(task *DispatcherTask) error {
	var err error = nil
	switch task.taskType {
	case DISPATCHER_TASK_TYPE_ALERTS_PARTITION:
		taskInfo := task.taskInfo.(*DispatcherTaskAlertsPartition)
		err = cm.alertEngine.ScheduleAlertsForPartition(taskInfo.partitionNo, taskInfo.nodeCount)
		cm.log.Debug("Alert rules dispatcher - submitted next alerts batch")
	case DISPATCHER_TASK_TYPE_ALERTS_MISSING:
		//TODO
		cm.log.Debug("Alert rules dispatcher - submitted missing alerts batch")
	default:
		err = errors.New("Invalid task type " + string(task.taskType))
		cm.log.Error(err.Error())
	}
	return err
}

func (cm *ClusterManager) changeAlertingState(newState string) {
	cm.log.Info("Alerting state: " + cm.alertingState.status + " -> " + newState)
	cm.alertingState.status = newState
}
