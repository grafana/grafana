package sqlstore

import (
  "testing"
  . "github.com/smartystreets/goconvey/convey"
  m "github.com/wangy1931/grafana/pkg/models"
)

func TestServicesCommandAndQueries(t *testing.T) {
  Convey("Testing Servies DB Access", t, func() {
    InitTestDB(t)

    Convey("Given saved services", func() {
      Convey("servies would be added", func() {


        ac3cmd := m.GetCurrentDashboardDashboard{UserId:2}
        err := GetDashboardsOfUser(&ac3cmd)
        So(err, ShouldBeNil)
      })


    })

  })
}
