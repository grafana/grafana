package clustering

import (
	"context"
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

type DispatcherTaskStatus struct {
	success bool
	errmsg  string
}
type DispatcherTask struct {
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
			cm.alertsScheduler(tick, ticksCounter)
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
	if ticksCounter%10 == 0 {
		if cm.alertingState.status == m.CLN_ALERT_STATUS_SCHEDULING ||
			(cm.alertingState.status == m.CLN_ALERT_STATUS_PROCESSING && cm.hasPendingAlertJobs()) {
			return
		}
		if cm.alertingState.status != m.CLN_ALERT_STATUS_READY {
			cm.changeAlertingState(m.CLN_ALERT_STATUS_READY)
		}
		cm.checkMissingAlerts()

		lastHeartbeat, err := cm.clusterNodeMgmt.GetLastHeartbeat()
		if err != nil {
			cm.log.Error("Failed to get last heartbeat", "error", err)
			return
		}
		if lastHeartbeat > cm.alertingState.lastProcessedInterval {
			cm.changeAlertingState(m.CLN_ALERT_STATUS_SCHEDULING)
			alertDispatchTask := &DispatcherTask{
				interval:    lastHeartbeat,
				nodeCount:   0, // TODO
				partitionNo: 0, // TODO
			}
			cm.dispatcherTaskQ <- alertDispatchTask
			cm.alertingState.lastProcessedInterval = lastHeartbeat
		}
	}
	if ticksCounter%60 == 0 {
		cm.clusterNodeMgmt.CheckIn(cm.alertingState)
	}
}

func (cm *ClusterManager) hasPendingAlertJobs() bool {
	jobCount := cm.alertEngine.GetPendingJobCount()
	cm.log.Debug("Cluster manager ticker - pending alert jobs", "count", jobCount)
	return jobCount > 0
}

func (cm *ClusterManager) checkMissingAlerts() {
	cm.log.Debug("Cluster manager ticker - check missing alerts")
	//TODO
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
			err := cm.handlealertRulesDispatcherTask(task)
			if err != nil {
				cm.dispatcherTaskStatus <- &DispatcherTaskStatus{false, err.Error()}
			} else {
				cm.dispatcherTaskStatus <- &DispatcherTaskStatus{true, ""}
			}
		}
	}
}

func (cm *ClusterManager) handlealertRulesDispatcherTask(task *DispatcherTask) error {
	cm.log.Debug("Cluster manager ticker - dispatch next alert batch")

	//TODO
	return nil
}

func (cm *ClusterManager) changeAlertingState(newState string) {
	cm.log.Info("Alerting state: " + cm.alertingState.status + " -> " + newState)
	cm.alertingState.status = newState
}
