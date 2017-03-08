package api

import (
	"github.com/wangy1931/grafana/pkg/middleware"
  "github.com/wangy1931/grafana/pkg/setting"
  "github.com/wangy1931/grafana/pkg/log"
)

func GetCustomizedSource(c *middleware.Context) {
  log.Info("Alert Url: %v", setting.Alert.AlertUrlRoot)
  log.Info("ELk Url : %v", setting.ElkSource.ElkSourceUrlRoot)
  alert := make(map[string]interface{})
  alert["alert"] = setting.Alert.AlertUrlRoot
  alert["elk"] = setting.ElkSource.ElkSourceUrlRoot

  c.JSON(200, alert)
}

/*
func GetAlertSource(c *middleware.Context) {
	query := m.GetAlertSourceQuery{OrgId: c.OrgId}

	if err := bus.Dispatch(&query); err != nil {
		c.JsonApiErr(500, "Failed to query alert source", err)
		return
	}

  ds := query.Result

  c.JSON(200, &dtos.AlertSource{
    OrgId:             ds.OrgId,
    Url:               ds.Url,
  })

}
*/
