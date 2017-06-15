package sqlstore

import (
  "testing"
  . "github.com/smartystreets/goconvey/convey"
  m "github.com/wangy1931/grafana/pkg/models"
  "fmt"
)

func TestServicesCommandAndQueries(t *testing.T) {
  Convey("Testing Servies DB Access", t, func() {
    InitTestDB(t)

    Convey("Given saved services", func() {
      //Convey("servies would be added", func() {
      //  ac3cmd := m.GetCurrentDashboardDashboard{UserId:2}
      //  err := GetDashboardsOfUser(&ac3cmd)
      //  So(err, ShouldBeNil)
      //})

      Convey("add system pick up", func(){
        addOrudpate := m.AddOrUpdateSystemPick{UserId:"1", SystemId:1}
        err := AddSystemPick(&addOrudpate)
        So(err, ShouldBeNil)
        Convey("get system pick id", func(){
          getSystemPick := m.GetSystemPick{UserId:"1"}
          err := GetSystemPick(&getSystemPick)
          fmt.Println("======")
          fmt.Println(getSystemPick.Result);
          So(err, ShouldBeNil)
          So(getSystemPick.Result, ShouldNotBeNil)
        })
      })

    })

  })
}
