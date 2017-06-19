package clustering

import (
	"errors"
	"fmt"
	"testing"

	"time"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestClusterManager(t *testing.T) {
	Convey("Validate cluster manager", t, func() {
		setting.NewConfigContext(&setting.CommandLineArgs{
			HomePath: "../../../",
		})
		setting.AlertingEnabled = true
		setting.ExecuteAlerts = true
		setting.ClusteringEnabled = true

		handlers := &mockHandlers{}
		bus.AddHandler("test", handlers.getPendingJobCount)
		bus.AddHandler("test", handlers.getMissingAlertsQuery)
		bus.AddHandler("test", handlers.scheduleAlertsForPartitionCommand)

		cm := NewClusterManager()

		Convey("Test alerts scheduling", func() {
			handlers.reset()
			cm.clusterNodeMgmt = &mockClusterNodeMgmt{}

			// currently processing; do nothing
			cm.alertingState.status = m.CLN_ALERT_STATUS_PROCESSING
			handlers.pendingJobCount = 1
			cm.alertsScheduler()
			So(cm.alertingState.status, ShouldEqual, m.CLN_ALERT_STATUS_PROCESSING)

			//currently scheduled for processing; do nothing
			cm.alertingState.status = m.CLN_ALERT_STATUS_SCHEDULING
			handlers.pendingJobCount = 0
			cm.alertsScheduler()
			So(cm.alertingState.status, ShouldEqual, m.CLN_ALERT_STATUS_SCHEDULING)

			//normal processing; already processed for the last interval
			cm.alertingState.status = m.CLN_ALERT_STATUS_PROCESSING
			cm.alertingState.lastProcessedInterval = 1493233440
			handlers.pendingJobCount = 0
			mockCNM := &mockClusterNodeMgmt{
				nodeId:          "testnode:3000",
				activeNodeCount: 1,
				lastHeartbeat:   1493233440,
				activeNode:      &m.ActiveNode{},
			}
			cm.clusterNodeMgmt = mockCNM
			cm.alertsScheduler()
			So(cm.alertingState.status, ShouldEqual, m.CLN_ALERT_STATUS_READY)
			So(mockCNM.callCountGetLastHeartbeat, ShouldEqual, 1)
			So(mockCNM.callCountGetActiveNodesCount, ShouldEqual, 0)
			So(mockCNM.callCountGetNode, ShouldEqual, 0)
			So(cm.dispatcherTaskQ, ShouldBeEmpty)

			// normal processing; next interval to process
			cm.alertingState.status = m.CLN_ALERT_STATUS_READY
			cm.alertingState.lastProcessedInterval = 1493233440
			handlers.pendingJobCount = 0
			mockCNM = &mockClusterNodeMgmt{
				nodeId:          "testnode:3000",
				activeNodeCount: 1,
				lastHeartbeat:   1493233500,
				activeNode:      &m.ActiveNode{PartId: 0, AlertStatus: m.CLN_ALERT_STATUS_READY},
			}
			cm.clusterNodeMgmt = mockCNM
			cm.alertsScheduler()
			fmt.Println("status " + cm.alertingState.status)
			So(cm.alertingState.status, ShouldEqual, m.CLN_ALERT_STATUS_SCHEDULING)
			So(mockCNM.callCountGetLastHeartbeat, ShouldEqual, 1)
			So(mockCNM.callCountGetActiveNodesCount, ShouldEqual, 1)
			So(mockCNM.callCountGetNode, ShouldEqual, 1)
			So(len(cm.dispatcherTaskQ), ShouldEqual, 1)
			// dispatch successful
			handlers.scheduleAlertsForPartitionErr = nil
			task := <-cm.dispatcherTaskQ
			cm.handleAlertRulesDispatcherTask(task)
			So(len(cm.dispatcherTaskStatus), ShouldEqual, 1)
			status := <-cm.dispatcherTaskStatus
			So(status.success, ShouldBeTrue)
			So(status.taskType, ShouldEqual, DISPATCHER_TASK_TYPE_ALERTS_PARTITION)
			cm.handleDispatcherTaskStatus(status)
			So(cm.alertingState.status, ShouldEqual, m.CLN_ALERT_STATUS_PROCESSING)

			//normal processing; next interval to process; dispatch failed
			cm.alertingState.status = m.CLN_ALERT_STATUS_READY
			cm.alertingState.lastProcessedInterval = 1493233440
			handlers.pendingJobCount = 0
			mockCNM = &mockClusterNodeMgmt{
				nodeId:          "testnode:3000",
				activeNodeCount: 1,
				lastHeartbeat:   1493233500,
				activeNode:      &m.ActiveNode{PartId: 0, AlertStatus: m.CLN_ALERT_STATUS_READY},
			}
			cm.clusterNodeMgmt = mockCNM
			cm.alertsScheduler()
			So(cm.alertingState.status, ShouldEqual, m.CLN_ALERT_STATUS_SCHEDULING)
			So(mockCNM.callCountGetLastHeartbeat, ShouldEqual, 1)
			So(mockCNM.callCountGetActiveNodesCount, ShouldEqual, 1)
			So(mockCNM.callCountGetNode, ShouldEqual, 1)
			So(len(cm.dispatcherTaskQ), ShouldEqual, 1)
			// dispatch failed
			handlers.scheduleAlertsForPartitionErr = errors.New("some error")
			task = <-cm.dispatcherTaskQ
			cm.handleAlertRulesDispatcherTask(task)
			So(len(cm.dispatcherTaskStatus), ShouldEqual, 1)
			status = <-cm.dispatcherTaskStatus
			So(status.success, ShouldBeFalse)
			So(status.taskType, ShouldEqual, DISPATCHER_TASK_TYPE_ALERTS_PARTITION)
			cm.handleDispatcherTaskStatus(status)
			So(cm.alertingState.status, ShouldEqual, m.CLN_ALERT_STATUS_READY)
		})
	})
}

func TestClusterManagerForMissingAlerts(t *testing.T) {
	Convey("Validate cluster manager", t, func() {
		setting.NewConfigContext(&setting.CommandLineArgs{
			HomePath: "../../../",
		})
		setting.AlertingEnabled = true
		setting.ExecuteAlerts = true
		setting.ClusteringEnabled = true

		handlers := &mockHandlers{}
		bus.AddHandler("test", handlers.getPendingJobCount)
		bus.AddHandler("test", handlers.getMissingAlertsQuery)
		bus.AddHandler("test", handlers.scheduleAlertsForPartitionCommand)
		bus.AddHandler("test", handlers.ScheduleMissingAlertsCommand)

		cm := NewClusterManager()

		Convey("Test Missing alerts scheduling", func() {
			handlers.reset()
			cm.clusterNodeMgmt = &mockClusterNodeMgmt{}

			//Missing Alert Processing flow
			mockCNM := &mockClusterNodeMgmt{
				nodeId:          "testnode:3000",
				activeNodeCount: 1,
				lastHeartbeat:   1493233440,
				activeNode:      &m.ActiveNode{},
			}

			cm.alertingState.status = m.CLN_ALERT_STATUS_READY
			cm.alertingState.lastProcessedInterval = 1493233440
			handlers.pendingJobCount = 0
			alert1 := &m.Alert{
				Name:     "alert1",
				EvalDate: time.Now(),
			}
			missedAlerts := []*m.Alert{alert1}
			mockCNM = &mockClusterNodeMgmt{
				nodeId:          "testnode:3000",
				activeNodeCount: 1,
				lastHeartbeat:   1493233500,
				activeNode:      &m.ActiveNode{PartId: 0, AlertStatus: m.CLN_ALERT_STATUS_READY},
				missingAlerts:   missedAlerts,
			}
			cm.clusterNodeMgmt = mockCNM
			cm.alertsScheduler()
			// normal alerts dispatch successful
			handlers.scheduleAlertsForPartitionErr = nil
			normalTask := <-cm.dispatcherTaskQ
			cm.handleAlertRulesDispatcherTask(normalTask)
			So(len(cm.dispatcherTaskStatus), ShouldEqual, 1)
			status := <-cm.dispatcherTaskStatus
			cm.handleDispatcherTaskStatus(status)

			//process missing alerts
			So(mockCNM.callCountGetMissingAlerts, ShouldEqual, 1)
			So(mockCNM.callCountGetNodeProcessingMissingAlerts, ShouldEqual, 1)
			So(mockCNM.callCountGetLastHeartbeat, ShouldEqual, 2)
			So(mockCNM.callCountGetNode, ShouldEqual, 2)
			So(cm.alertingState.status, ShouldEqual, m.CLN_ALERT_STATUS_SCHEDULING)
			So(cm.alertingState.run_type, ShouldEqual, m.CLN_ALERT_RUN_TYPE_MISSING)
			So(mockCNM.callCountCheckInNodeProcessingMissingAlerts, ShouldEqual, 1)

			// missing alerts dispatch successful
			handlers.scheduleMissingAlertsErr = nil
			missingAlertTask := <-cm.dispatcherTaskQ
			cm.handleAlertRulesDispatcherTask(missingAlertTask)
			missingAlertTaskStatus := <-cm.dispatcherTaskStatus
			So(missingAlertTaskStatus.success, ShouldBeTrue)
			So(missingAlertTaskStatus.taskType, ShouldEqual, DISPATCHER_TASK_TYPE_ALERTS_MISSING)
			cm.handleDispatcherTaskStatus(missingAlertTaskStatus)
			So(cm.alertingState.status, ShouldEqual, m.CLN_ALERT_STATUS_PROCESSING)
		})
	})
}

type mockHandlers struct {
	pendingJobCount               int
	alerts                        []*m.Alert
	scheduleAlertsForPartitionErr error
	scheduleMissingAlertsErr      error
}

func (mh *mockHandlers) reset() {
	mh.pendingJobCount = 0
	mh.alerts = nil
	mh.scheduleAlertsForPartitionErr = nil
	mh.scheduleMissingAlertsErr = nil
}
func (mh *mockHandlers) getPendingJobCount(query *alerting.PendingAlertJobCountQuery) error {
	query.ResultCount = mh.pendingJobCount
	return nil
}
func (mh *mockHandlers) getMissingAlertsQuery(query *m.GetMissingAlertsQuery) error {
	query.Result = mh.alerts
	return nil
}
func (mh *mockHandlers) scheduleAlertsForPartitionCommand(cmd *alerting.ScheduleAlertsForPartitionCommand) error {
	return mh.scheduleAlertsForPartitionErr
}

func (mh *mockHandlers) ScheduleMissingAlertsCommand(cmd *alerting.ScheduleMissingAlertsCommand) error {
	return mh.scheduleMissingAlertsErr
}

type mockClusterNodeMgmt struct {
	retError                                    error
	nodeId                                      string
	activeNode                                  *m.ActiveNode
	activeNodeCount                             int
	lastHeartbeat                               int64
	missingAlerts                               []*m.Alert
	nodeProcessingMissingAlert                  *m.ActiveNode
	callCountGetNodeId                          int
	callCountCheckIn                            int
	callCountGetNode                            int
	callCountCheckInNodeProcessingMissingAlerts int
	callCountGetActiveNodesCount                int
	callCountGetLastHeartbeat                   int
	callCountGetMissingAlerts                   int
	callCountGetNodeProcessingMissingAlerts     int
}

func (cn *mockClusterNodeMgmt) GetNodeId() (string, error) {
	cn.callCountGetNodeId++
	return cn.nodeId, cn.retError
}
func (cn *mockClusterNodeMgmt) CheckIn(alertingState *AlertingState) error {
	cn.callCountCheckIn++
	return cn.retError
}
func (cn *mockClusterNodeMgmt) GetNode(heartbeat int64) (*m.ActiveNode, error) {
	cn.callCountGetNode++
	return cn.activeNode, cn.retError
}
func (cn *mockClusterNodeMgmt) CheckInNodeProcessingMissingAlerts(alertingState *AlertingState) error {
	cn.callCountCheckInNodeProcessingMissingAlerts++
	return cn.retError
}
func (cn *mockClusterNodeMgmt) GetActiveNodesCount(heartbeat int64) (int, error) {
	cn.callCountGetActiveNodesCount++
	return cn.activeNodeCount, cn.retError
}
func (cn *mockClusterNodeMgmt) GetLastHeartbeat() (int64, error) {
	cn.callCountGetLastHeartbeat++
	return cn.lastHeartbeat, cn.retError
}

func (cn *mockClusterNodeMgmt) GetMissingAlerts() []*m.Alert {
	cn.callCountGetMissingAlerts++
	return cn.missingAlerts
}

func (cn *mockClusterNodeMgmt) GetNodeProcessingMissingAlerts() *m.ActiveNode {
	cn.callCountGetNodeProcessingMissingAlerts++
	return cn.nodeProcessingMissingAlert
}
