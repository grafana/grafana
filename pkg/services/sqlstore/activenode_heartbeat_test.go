package sqlstore

import (
	"testing"

	"fmt"

	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestActiveNode(t *testing.T) {
	Convey("Testing insert Active Data Node item", t, func() {
		InitTestDB(t)
		act := m.ActiveNodeHeartbeat{
			Id:           11,
			Heartbeat:    1490998410,
			NodeId:       "10.0.0.1:3030",
			PartitionNo:  122,
			AlertRunType: m.NORMAL_ALERT,
		}
		cmd := m.SaveActiveNodeCommand{
			&act,
		}

		err := InsertActiveNode(&cmd)

		Convey("Can  insert active node", func() {
			So(err, ShouldBeNil)
		})

		query := m.GetActiveNodeByIDQuery{
			Id: 11,
		}
		err2 := GetActiveNodeById(&query)
		fmt.Println("Result of inserting normal node: %v", query.Result)
		Convey("Retrive data", func() {
			So(err2, ShouldBeNil)
			So(query.Result.NodeId, ShouldEqual, "10.0.0.1:3030")
			So(query.Result.Heartbeat, ShouldEqual, 1490998410)
			So(query.Result.PartitionNo, ShouldEqual, 122)
		})

		/*
		 * Test insertion of node processing missing alert
		 */
		act3 := m.SaveNodeByIdCmd{NodeId: "10.1.1.1:4043"}
		err3 := InsertNodeProcessingMissingAlerts(&act3)

		Convey("Can insert Node processing missing alert", func() {
			So(err3, ShouldBeNil)
		})

		act11 := m.ActiveNodeHeartbeat{}
		cmd22 := m.GetNodeProcessingMissingAlertQuery{
			&act11,
		}
		err4 := GetNodeProcessingMissingAlert(&cmd22)
		Convey("Get Node Processing Missing Alert", func() {
			So(err4, ShouldBeNil)

		})

	})
}
