package stores

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
	"github.com/torkelo/grafana-pro/pkg/models"
)

func TestRethinkStore(t *testing.T) {

	Convey("Insert dashboard", t, func() {
		store := NewRethinkStore(&RethinkCfg{DatabaseName: "tests"})
		//defer r.DbDrop("tests").Exec(store.session)

		dashboard := models.NewDashboard("test")
		dashboard.AccountId = "123"

		err := store.SaveDashboard(dashboard)
		So(err, ShouldBeNil)
		So(dashboard.Id, ShouldNotBeEmpty)

		read, err := store.GetDashboardByTitle("test", "123")
		So(err, ShouldBeNil)
		So(read, ShouldNotBeNil)

	})

}
