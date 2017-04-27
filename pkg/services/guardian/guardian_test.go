package guardian

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestGuardian(t *testing.T) {

	Convey("Given a user with list of dashboards that they have access to", t, func() {
		hitList := []int64{1, 2}

		var orgId int64 = 1
		var userId int64 = 1

		Convey("And the user is a Grafana admin", func() {
			bus.AddHandler("test", func(query *m.GetSignedInUserQuery) error {
				query.Result = &m.SignedInUser{IsGrafanaAdmin: true}
				return nil
			})

			filteredHitlist, err := RemoveRestrictedDashboards(hitList, orgId, userId)
			So(err, ShouldBeNil)

			Convey("should return all dashboards", func() {
				So(len(filteredHitlist), ShouldEqual, 2)
				So(filteredHitlist[0], ShouldEqual, 1)
				So(filteredHitlist[1], ShouldEqual, 2)
			})
		})

		Convey("And the user is an org admin", func() {
			bus.AddHandler("test", func(query *m.GetSignedInUserQuery) error {
				query.Result = &m.SignedInUser{IsGrafanaAdmin: false, OrgRole: m.ROLE_ADMIN}
				return nil
			})

			filteredHitlist, err := RemoveRestrictedDashboards(hitList, orgId, userId)
			So(err, ShouldBeNil)

			Convey("should return all dashboards", func() {
				So(len(filteredHitlist), ShouldEqual, 2)
				So(filteredHitlist[0], ShouldEqual, 1)
				So(filteredHitlist[1], ShouldEqual, 2)
			})
		})

		Convey("And the user is an editor", func() {
			bus.AddHandler("test", func(query *m.GetSignedInUserQuery) error {
				query.Result = &m.SignedInUser{IsGrafanaAdmin: false, OrgRole: m.ROLE_EDITOR}
				return nil
			})
			bus.AddHandler("test2", func(query *m.GetAllowedDashboardsQuery) error {
				query.Result = []int64{1}
				return nil
			})

			filteredHitlist, err := RemoveRestrictedDashboards(hitList, orgId, userId)
			So(err, ShouldBeNil)

			Convey("should return dashboard that editor has access to", func() {
				So(len(filteredHitlist), ShouldEqual, 1)
				So(filteredHitlist[0], ShouldEqual, 1)
			})
		})
	})
}
