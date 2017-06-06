package sqlstore

import (
	"testing"

	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestActiveNode(t *testing.T) {
	Convey("Testing insert Active Data Node item", t, func() {
		InitTestDB(t)
		act := m.ActiveNode{
			Id:        11,
			Heartbeat: 1490998410,
			NodeId:    "10.0.0.1:3030",
			Sequence:  122,
		}
		cmd := m.SaveActiveNodeCommand{
			ActiveNode: []*m.ActiveNode{
				&act,
			},
		}

		err := InsertActiveNode(&cmd)

		Convey("Can  insert active node", func() {
			So(err, ShouldBeNil)
		})

		query := m.GetActiveNodeByIDQuery{
			Id: 11,
		}
		err2 := GetActiveNodeById(&query)
		Convey("Retrive data", func() {
			So(err2, ShouldBeNil)
			So(len(query.Result), ShouldEqual, 1)
			So(query.Result[0].NodeId, ShouldEqual, "10.0.0.1:3030")
			So(query.Result[0].Heartbeat, ShouldEqual, 1490998410)
			So(query.Result[0].Sequence, ShouldEqual, 122)
		})

	})
}
