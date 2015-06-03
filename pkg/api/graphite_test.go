package api

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestGraphiteRaintankQueries(t *testing.T) {

	Convey("Given raintank collector tags query", t, func() {
		bus.AddHandler("test", func(query *m.GetAllCollectorTagsQuery) error {
			So(query.OrgId, ShouldEqual, 10)

			query.Result = []string{"tag1", "tag2"}
			return nil
		})

		resp, err := executeRaintankDbQuery("raintank_db.tags.collectors.*", 10)
		So(err, ShouldBeNil)

		Convey("should return tags", func() {
			array := resp.([]map[string]interface{})
			So(len(array), ShouldEqual, 2)
			So(array[0]["text"], ShouldEqual, "tag1")
		})
	})

	Convey("Given raintank collector tag valuess query", t, func() {
		bus.AddHandler("test", func(query *m.GetCollectorsQuery) error {
			So(query.OrgId, ShouldEqual, 10)
			So(len(query.Tag), ShouldEqual, 1)
			So(query.Tag[0], ShouldEqual, "Europe")

			query.Result = []*m.CollectorDTO{
				&m.CollectorDTO{Name: "dev-1", Slug: "dev1"},
			}
			return nil
		})

		resp, err := executeRaintankDbQuery("raintank_db.tags.collectors.Europe.*", 10)
		So(err, ShouldBeNil)

		Convey("should return tags", func() {
			array := resp.([]map[string]interface{})
			So(len(array), ShouldEqual, 1)
			So(array[0]["text"], ShouldEqual, "dev1")
		})
	})

}
