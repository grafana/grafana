package sqlstore

import (
	"fmt"

	"github.com/go-xorm/xorm"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", SaveAlerts)
}

func SaveAlerts(cmd *m.SaveAlertsCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		fmt.Printf("Saving alerts for dashboard %v\n", cmd.DashboardId)

		for _, alert := range *cmd.Alerts {
			_, err := x.Insert(&alert)
			if err != nil {
				return err
			}
		}

		return nil
	})
}
