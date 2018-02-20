package sqlstore

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
)

func TestDashboardSnapshotDBAccess(t *testing.T) {

	Convey("Testing DashboardSnapshot data access", t, func() {
		InitTestDB(t)

		Convey("Given saved snapshot", func() {
			cmd := m.CreateDashboardSnapshotCommand{
				Key: "hej",
				Dashboard: simplejson.NewFromAny(map[string]interface{}{
					"hello": "mupp",
				}),
				UserId: 1000,
				OrgId:  1,
			}
			err := CreateDashboardSnapshot(&cmd)
			So(err, ShouldBeNil)

			Convey("Should be able to get snapshot by key", func() {
				query := m.GetDashboardSnapshotQuery{Key: "hej"}
				err = GetDashboardSnapshot(&query)
				So(err, ShouldBeNil)

				So(query.Result, ShouldNotBeNil)
				So(query.Result.Dashboard.Get("hello").MustString(), ShouldEqual, "mupp")
			})

			Convey("And the user has the admin role", func() {
				Convey("Should return all the snapshots", func() {
					query := m.GetDashboardSnapshotsQuery{
						OrgId:        1,
						SignedInUser: &m.SignedInUser{OrgRole: m.ROLE_ADMIN},
					}
					err := SearchDashboardSnapshots(&query)
					So(err, ShouldBeNil)

					So(query.Result, ShouldNotBeNil)
					So(len(query.Result), ShouldEqual, 1)
				})
			})

			Convey("And the user has the editor role and has created a snapshot", func() {
				Convey("Should return all the snapshots", func() {
					query := m.GetDashboardSnapshotsQuery{
						OrgId:        1,
						SignedInUser: &m.SignedInUser{OrgRole: m.ROLE_EDITOR, UserId: 1000},
					}
					err := SearchDashboardSnapshots(&query)
					So(err, ShouldBeNil)

					So(query.Result, ShouldNotBeNil)
					So(len(query.Result), ShouldEqual, 1)
				})
			})

			Convey("And the user has the editor role and has not created any snapshot", func() {
				Convey("Should not return any snapshots", func() {
					query := m.GetDashboardSnapshotsQuery{
						OrgId:        1,
						SignedInUser: &m.SignedInUser{OrgRole: m.ROLE_EDITOR, UserId: 2},
					}
					err := SearchDashboardSnapshots(&query)
					So(err, ShouldBeNil)

					So(query.Result, ShouldNotBeNil)
					So(len(query.Result), ShouldEqual, 0)
				})
			})

			Convey("And the user is anonymous", func() {
				cmd := m.CreateDashboardSnapshotCommand{
					Key:       "strangesnapshotwithuserid0",
					DeleteKey: "adeletekey",
					Dashboard: simplejson.NewFromAny(map[string]interface{}{
						"hello": "mupp",
					}),
					UserId: 0,
					OrgId:  1,
				}
				err := CreateDashboardSnapshot(&cmd)
				So(err, ShouldBeNil)

				Convey("Should not return any snapshots", func() {
					query := m.GetDashboardSnapshotsQuery{
						OrgId:        1,
						SignedInUser: &m.SignedInUser{OrgRole: m.ROLE_EDITOR, IsAnonymous: true, UserId: 0},
					}
					err := SearchDashboardSnapshots(&query)
					So(err, ShouldBeNil)

					So(query.Result, ShouldNotBeNil)
					So(len(query.Result), ShouldEqual, 0)
				})
			})
		})
	})
}
