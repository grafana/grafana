package sqlstore

import (
	"testing"
	"time"

	"github.com/go-xorm/xorm"
	. "github.com/smartystreets/goconvey/convey"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
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

func TestDeleteExpiredSnapshots(t *testing.T) {
	Convey("Testing dashboard snapshots clean up", t, func() {
		x := InitTestDB(t)

		setting.SnapShotRemoveExpired = true

		notExpiredsnapshot := createTestSnapshot(x, "key1", 1000)
		createTestSnapshot(x, "key2", -1000)
		createTestSnapshot(x, "key3", -1000)

		Convey("Clean up old dashboard snapshots", func() {
			err := DeleteExpiredSnapshots(&m.DeleteExpiredSnapshotsCommand{})
			So(err, ShouldBeNil)

			query := m.GetDashboardSnapshotsQuery{
				OrgId:        1,
				SignedInUser: &m.SignedInUser{OrgRole: m.ROLE_ADMIN},
			}
			err = SearchDashboardSnapshots(&query)
			So(err, ShouldBeNil)

			So(len(query.Result), ShouldEqual, 1)
			So(query.Result[0].Key, ShouldEqual, notExpiredsnapshot.Key)
		})

		Convey("Don't delete anything if there are no expired snapshots", func() {
			err := DeleteExpiredSnapshots(&m.DeleteExpiredSnapshotsCommand{})
			So(err, ShouldBeNil)

			query := m.GetDashboardSnapshotsQuery{
				OrgId:        1,
				SignedInUser: &m.SignedInUser{OrgRole: m.ROLE_ADMIN},
			}
			SearchDashboardSnapshots(&query)

			So(len(query.Result), ShouldEqual, 1)
		})
	})
}

func createTestSnapshot(x *xorm.Engine, key string, expires int64) *m.DashboardSnapshot {
	cmd := m.CreateDashboardSnapshotCommand{
		Key:       key,
		DeleteKey: "delete" + key,
		Dashboard: simplejson.NewFromAny(map[string]interface{}{
			"hello": "mupp",
		}),
		UserId:  1000,
		OrgId:   1,
		Expires: expires,
	}
	err := CreateDashboardSnapshot(&cmd)
	So(err, ShouldBeNil)

	// Set expiry date manually - to be able to create expired snapshots
	expireDate := time.Now().Add(time.Second * time.Duration(expires))
	_, err = x.Exec("update dashboard_snapshot set expires = ? where "+dialect.Quote("key")+" = ?", expireDate, key)
	So(err, ShouldBeNil)

	return cmd.Result
}
