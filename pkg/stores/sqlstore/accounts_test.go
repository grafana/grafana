package sqlstore

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	m "github.com/torkelo/grafana-pro/pkg/models"
)

func TestAccountDataAccess(t *testing.T) {

	Convey("Testing Account DB Access", t, func() {
		InitTestDB(t)

		Convey("Can save account", func() {
			account := m.Account{
				Login: "login",
				Email: "login@test.com",
				Name:  "name",
			}

			err := SaveAccount(&account)

			query := m.GetAccountInfoQuery{Id: account.Id}
			err = GetAccountInfo(&query)

			So(err, ShouldBeNil)
			So(query.Result.Name, ShouldEqual, "name")
		})
	})
}
