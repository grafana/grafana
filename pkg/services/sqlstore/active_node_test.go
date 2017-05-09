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
			So(cmd.Result.PartitionNo, ShouldEqual, 0)
		})

		/*
		*Test insertion of node processing missing alerts
		 */
		act2 := m.ActiveNode{
			NodeId:       "10.1.1.1:4330",
			AlertRunType: "",
			AlertStatus:  m.CLN_ALERT_STATUS_READY,
		}
		cmd2 := m.SaveNodeProcessingMissingAlertCommand{Node: &act2}
		err2 := InsertNodeProcessingMissingAlert(&cmd2)
		Convey("Can  insert node processing missing alert", func() {
			So(err2, ShouldBeNil)
		})
		Convey("Retrive Node Processing Missing Alert", func() {
			So(cmd2.Result, ShouldNotBeNil)
			So(cmd2.Result.NodeId, ShouldEqual, "10.1.1.1:4330")
			So(cmd2.Result.Heartbeat, ShouldBeGreaterThan, 0)
			So(cmd2.Result.PartitionNo, ShouldEqual, 0)
			So(cmd2.Result.AlertRunType, ShouldEqual, m.CLN_ALERT_RUN_TYPE_MISSING)
		})

		// test active node count
		cmd3 := m.GetLastDBTimeIntervalQuery {}
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
