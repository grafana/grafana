// +build integration

package sqlstore

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestQuotaCommandsAndQueries(t *testing.T) {
	Convey("Testing Quota commands & queries", t, func() {
		InitTestDB(t)
		userId := int64(1)
		orgId := int64(0)

		setting.Quota = setting.QuotaSettings{
			Enabled: true,
			Org: &setting.OrgQuota{
				User:       5,
				Dashboard:  5,
				DataSource: 5,
				ApiKey:     5,
			},
			User: &setting.UserQuota{
				Org: 5,
			},
			Global: &setting.GlobalQuota{
				Org:        5,
				User:       5,
				Dashboard:  5,
				DataSource: 5,
				ApiKey:     5,
				Session:    5,
			},
		}

		// create a new org and add user_id 1 as admin.
		// we will then have an org with 1 user. and a user
		// with 1 org.
		userCmd := models.CreateOrgCommand{
			Name:   "TestOrg",
			UserId: 1,
		}

		err := CreateOrg(&userCmd)
		So(err, ShouldBeNil)
		orgId = userCmd.Result.Id

		Convey("Given saved org quota for users", func() {
			orgCmd := models.UpdateOrgQuotaCmd{
				OrgId:  orgId,
				Target: "org_user",
				Limit:  10,
			}
			err := UpdateOrgQuota(&orgCmd)
			So(err, ShouldBeNil)

			Convey("Should be able to get saved quota by org id and target", func() {
				query := models.GetOrgQuotaByTargetQuery{OrgId: orgId, Target: "org_user", Default: 1}
				err = GetOrgQuotaByTarget(&query)

				So(err, ShouldBeNil)
				So(query.Result.Limit, ShouldEqual, 10)
			})
			Convey("Should be able to get default quota by org id and target", func() {
				query := models.GetOrgQuotaByTargetQuery{OrgId: 123, Target: "org_user", Default: 11}
				err = GetOrgQuotaByTarget(&query)

				So(err, ShouldBeNil)
				So(query.Result.Limit, ShouldEqual, 11)
			})
			Convey("Should be able to get used org quota when rows exist", func() {
				query := models.GetOrgQuotaByTargetQuery{OrgId: orgId, Target: "org_user", Default: 11}
				err = GetOrgQuotaByTarget(&query)

				So(err, ShouldBeNil)
				So(query.Result.Used, ShouldEqual, 1)
			})
			Convey("Should be able to get used org quota when no rows exist", func() {
				query := models.GetOrgQuotaByTargetQuery{OrgId: 2, Target: "org_user", Default: 11}
				err = GetOrgQuotaByTarget(&query)

				So(err, ShouldBeNil)
				So(query.Result.Used, ShouldEqual, 0)
			})
			Convey("Should be able to quota list for org", func() {
				query := models.GetOrgQuotasQuery{OrgId: orgId}
				err = GetOrgQuotas(&query)

				So(err, ShouldBeNil)
				So(len(query.Result), ShouldEqual, 4)
				for _, res := range query.Result {
					limit := 5 // default quota limit
					used := 0
					if res.Target == "org_user" {
						limit = 10 // customized quota limit.
						used = 1
					}
					So(res.Limit, ShouldEqual, limit)
					So(res.Used, ShouldEqual, used)
				}
			})
		})
		Convey("Given saved user quota for org", func() {
			userQuotaCmd := models.UpdateUserQuotaCmd{
				UserId: userId,
				Target: "org_user",
				Limit:  10,
			}
			err := UpdateUserQuota(&userQuotaCmd)
			So(err, ShouldBeNil)

			Convey("Should be able to get saved quota by user id and target", func() {
				query := models.GetUserQuotaByTargetQuery{UserId: userId, Target: "org_user", Default: 1}
				err = GetUserQuotaByTarget(&query)

				So(err, ShouldBeNil)
				So(query.Result.Limit, ShouldEqual, 10)
			})
			Convey("Should be able to get default quota by user id and target", func() {
				query := models.GetUserQuotaByTargetQuery{UserId: 9, Target: "org_user", Default: 11}
				err = GetUserQuotaByTarget(&query)

				So(err, ShouldBeNil)
				So(query.Result.Limit, ShouldEqual, 11)
			})
			Convey("Should be able to get used user quota when rows exist", func() {
				query := models.GetUserQuotaByTargetQuery{UserId: userId, Target: "org_user", Default: 11}
				err = GetUserQuotaByTarget(&query)

				So(err, ShouldBeNil)
				So(query.Result.Used, ShouldEqual, 1)
			})
			Convey("Should be able to get used user quota when no rows exist", func() {
				query := models.GetUserQuotaByTargetQuery{UserId: 2, Target: "org_user", Default: 11}
				err = GetUserQuotaByTarget(&query)

				So(err, ShouldBeNil)
				So(query.Result.Used, ShouldEqual, 0)
			})
			Convey("Should be able to quota list for user", func() {
				query := models.GetUserQuotasQuery{UserId: userId}
				err = GetUserQuotas(&query)

				So(err, ShouldBeNil)
				So(len(query.Result), ShouldEqual, 1)
				So(query.Result[0].Limit, ShouldEqual, 10)
				So(query.Result[0].Used, ShouldEqual, 1)
			})
		})

		Convey("Should be able to global user quota", func() {
			query := models.GetGlobalQuotaByTargetQuery{Target: "user", Default: 5}
			err = GetGlobalQuotaByTarget(&query)
			So(err, ShouldBeNil)

			So(query.Result.Limit, ShouldEqual, 5)
			So(query.Result.Used, ShouldEqual, 0)
		})
		Convey("Should be able to global org quota", func() {
			query := models.GetGlobalQuotaByTargetQuery{Target: "org", Default: 5}
			err = GetGlobalQuotaByTarget(&query)
			So(err, ShouldBeNil)

			So(query.Result.Limit, ShouldEqual, 5)
			So(query.Result.Used, ShouldEqual, 1)
		})

		// related: https://github.com/grafana/grafana/issues/14342
		Convey("Should org quota updating is successful even if it called multiple time", func() {
			orgCmd := models.UpdateOrgQuotaCmd{
				OrgId:  orgId,
				Target: "org_user",
				Limit:  5,
			}
			err := UpdateOrgQuota(&orgCmd)
			So(err, ShouldBeNil)

			query := models.GetOrgQuotaByTargetQuery{OrgId: orgId, Target: "org_user", Default: 1}
			err = GetOrgQuotaByTarget(&query)
			So(err, ShouldBeNil)
			So(query.Result.Limit, ShouldEqual, 5)

			// XXX: resolution of `Updated` column is 1sec, so this makes delay
			time.Sleep(1 * time.Second)

			orgCmd = models.UpdateOrgQuotaCmd{
				OrgId:  orgId,
				Target: "org_user",
				Limit:  10,
			}
			err = UpdateOrgQuota(&orgCmd)
			So(err, ShouldBeNil)

			query = models.GetOrgQuotaByTargetQuery{OrgId: orgId, Target: "org_user", Default: 1}
			err = GetOrgQuotaByTarget(&query)
			So(err, ShouldBeNil)
			So(query.Result.Limit, ShouldEqual, 10)
		})

		// related: https://github.com/grafana/grafana/issues/14342
		Convey("Should user quota updating is successful even if it called multiple time", func() {
			userQuotaCmd := models.UpdateUserQuotaCmd{
				UserId: userId,
				Target: "org_user",
				Limit:  5,
			}
			err := UpdateUserQuota(&userQuotaCmd)
			So(err, ShouldBeNil)

			query := models.GetUserQuotaByTargetQuery{UserId: userId, Target: "org_user", Default: 1}
			err = GetUserQuotaByTarget(&query)
			So(err, ShouldBeNil)
			So(query.Result.Limit, ShouldEqual, 5)

			// XXX: resolution of `Updated` column is 1sec, so this makes delay
			time.Sleep(1 * time.Second)

			userQuotaCmd = models.UpdateUserQuotaCmd{
				UserId: userId,
				Target: "org_user",
				Limit:  10,
			}
			err = UpdateUserQuota(&userQuotaCmd)
			So(err, ShouldBeNil)

			query = models.GetUserQuotaByTargetQuery{UserId: userId, Target: "org_user", Default: 1}
			err = GetUserQuotaByTarget(&query)
			So(err, ShouldBeNil)
			So(query.Result.Limit, ShouldEqual, 10)
		})
	})
}
