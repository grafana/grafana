package stores

import (
	"testing"

	"github.com/dancannon/gorethink"
	. "github.com/smartystreets/goconvey/convey"
	"github.com/torkelo/grafana-pro/pkg/models"
)

func TestRethinkStore(t *testing.T) {
	store := NewRethinkStore(&RethinkCfg{DatabaseName: "tests"})
	defer gorethink.DbDrop("tests").Exec(store.session)

	Convey("Insert dashboard", t, func() {
		dashboard := models.NewDashboard("test")
		dashboard.AccountId = 1

		err := store.SaveDashboard(dashboard)
		So(err, ShouldBeNil)
		So(dashboard.Id, ShouldNotBeEmpty)

		read, err := store.GetDashboard("test", 1)
		So(err, ShouldBeNil)
		So(read, ShouldNotBeNil)
	})

	Convey("can get next account id", t, func() {
		id, err := store.getNextAccountId()
		So(err, ShouldBeNil)
		So(id, ShouldNotEqual, 0)

		id2, err := store.getNextAccountId()
		So(id2, ShouldEqual, id+1)
	})

	Convey("can create account", t, func() {
		account := &models.UserAccount{UserName: "torkelo", Email: "mupp", Login: "test@test.com"}
		err := store.SaveUserAccount(account)
		So(err, ShouldBeNil)
		So(account.DatabaseId, ShouldNotEqual, 0)

		read, err := store.GetUserAccountLogin("test@test.com")
		So(err, ShouldBeNil)
		So(read.DatabaseId, ShouldEqual, account.DatabaseId)
	})

	Convey("can get next dashboard id", t, func() {
		account := &models.UserAccount{UserName: "torkelo", Email: "mupp"}
		err := store.SaveUserAccount(account)
		dashId, err := store.getNextDashboardNumber(account.DatabaseId)
		So(err, ShouldBeNil)
		So(dashId, ShouldEqual, 1)
	})

}
