package clustering

import (
	"context"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/services/alerting"
	"golang.org/x/sync/errgroup"
)

type ClusterManager struct {
	clusterNodeMgmt ClusterNodeMgmt
	ticker          *alerting.Ticker // using the ticker from alerting package for now. Should move the impl outside alerting later
	log             log.Logger
	alertEngine     *alerting.Engine
}

func NewClusterManager() *ClusterManager {
	cm := &ClusterManager{
		clusterNodeMgmt: getClusterNode(),
		ticker:          alerting.NewTicker(time.Now(), time.Second*0, clock.New()),
		log:             log.New("clustering.clusterManager"),
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

	// TODO register node
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
		}
	}
}

func (cm *ClusterManager) alertsScheduler(tick time.Time, ticksCounter int) {
	if ticksCounter%10 == 0 {
		if cm.hasPendingAlertJobs() {
			return
		}
		cm.checkMissingAlerts()
		cm.prepareNextAlertsBatch()
		if cm.checkMinuteBoundary() {
			//cm.clusterNodeMgmt.CheckIn()
			cm.dispatchAlertsBatch()
		}
	}
	if ticksCounter%60 == 0 {
		cm.clusterNodeMgmt.CheckIn()
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

func (cm *ClusterManager) prepareNextAlertsBatch() {
	cm.log.Debug("Cluster manager ticker - prepare next alert batch")
	//TODO
	if cm.isBatchPrepared() {
		cm.log.Debug("Cluster manager ticker - next alert batch already created")
		return
	}
}

func (cm *ClusterManager) isBatchPrepared() bool {
	//TODO
	return false
}

func (cm *ClusterManager) checkMinuteBoundary() bool {
	cm.log.Debug("Cluster manager ticker - minute boundary check")
	//TODO
	return false
}

func (cm *ClusterManager) dispatchAlertsBatch() {
	cm.log.Debug("Cluster manager ticker - dispatch next alert batch")
	//TODO
}
