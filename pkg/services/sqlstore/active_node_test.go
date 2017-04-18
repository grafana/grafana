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
			AlertRunType: "Normal",
		}
		cmd := m.SaveActiveNodeCommand{
			Node: &act,
		}

		err := InsertActiveNodeHeartbeat(&cmd)
		Convey("Can  insert active node", func() {
			So(err, ShouldBeNil)
		})

		Convey("Retrive data", func() {
			So(cmd.Result, ShouldNotBeNil)
			So(cmd.Result.NodeId, ShouldEqual, "10.0.0.1:3030")
			So(cmd.Result.Heartbeat, ShouldBeGreaterThan, 0)
			So(cmd.Result.PartitionNo, ShouldEqual, 1)
		})

	})
}
