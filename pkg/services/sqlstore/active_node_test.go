package sqlstore

import (
	"testing"

	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestActiveNode(t *testing.T) {
	Convey("Testing insert active node heartbeat", t, func() {
		InitTestDB(t)
		act := m.ActiveNode{
			NodeId:       "10.0.0.1:3030",
			AlertRunType: m.CLN_ALERT_RUN_TYPE_NORMAL,
			AlertStatus:  m.CLN_ALERT_STATUS_READY,
		}
		cmd := m.SaveActiveNodeCommand{
			Node:        &act,
			FetchResult: true,
		}

		err := InsertActiveNodeHeartbeat(&cmd)
		Convey("Can  insert active node", func() {
			So(err, ShouldBeNil)
		})

		Convey("Retrive data", func() {
			So(cmd.Result, ShouldNotBeNil)
			So(cmd.Result.NodeId, ShouldEqual, "10.0.0.1:3030")
			So(cmd.Result.Heartbeat, ShouldBeGreaterThan, 0)
			So(cmd.Result.PartId, ShouldEqual, 0)
		})

		/*
		*Test insertion of node processing missing alerts
		 */
		nodeID := "10.1.1.1:4330"
		cmd2 := m.SaveNodeProcessingMissingAlertCommand{
			Node: &m.ActiveNode{
				NodeId:       nodeID,
				AlertRunType: m.CLN_ALERT_RUN_TYPE_MISSING,
				AlertStatus:  m.CLN_ALERT_STATUS_READY,
			},
		}
		err2 := InsertNodeProcessingMissingAlert(&cmd2)
		Convey("Can  insert node processing missing alert", func() {
			So(err2, ShouldBeNil)
		})

		cmd4 := m.GetNodeProcessingMissingAlertsCommand{}
		err4 := GetNodeProcessingMissingAlerts(&cmd4)
		Convey("Retrive Node Processing Missing Alert", func() {
			So(err4, ShouldBeNil)
			So(cmd4.Result.NodeId, ShouldEqual, nodeID)
			So(cmd2.Result.Heartbeat, ShouldBeGreaterThan, 0)
			So(cmd2.Result.PartId, ShouldEqual, 0)
			So(cmd2.Result.AlertRunType, ShouldEqual, m.CLN_ALERT_RUN_TYPE_MISSING)
			So(cmd2.Result.AlertStatus, ShouldEqual, m.CLN_ALERT_STATUS_READY)
		})

		// test active node count
		cmd3 := m.GetLastDBTimeIntervalQuery{}
		err3 := GetLastDBTimeInterval(&cmd3)
		Convey("Can  get last heartbeat", func() {
			So(err3, ShouldBeNil)
		})
		Convey("getting last heartbeat", func() {
			So(cmd3.Result, ShouldNotBeNil)
		})

		// cmd4 := m.GetActiveNodesCountCommand {
		//  NodeId:     cmd3.Node.NodeId,
		//  Heartbeat:  cmd3.Result,
		// }

		// err4 := GetActiveNodesCount(&cmd4)
		// Convey("Can  get active node count", func() {
		//  So(err4, ShouldBeNil)
		// })
		// Convey("getting active node count", func() {
		//  So(cmd4.Result, ShouldNotBeNil)
		// })
	})
}
