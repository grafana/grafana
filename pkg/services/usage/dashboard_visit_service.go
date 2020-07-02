package usage

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func init() {
	registry.Register(&registry.Descriptor{
		Name:         "VisitDashboardService",
		Instance:     &VisitDashboardService{},
		InitPriority: registry.Low,
	})
}

type VisitDashboardService struct {
	Bus      bus.Bus            `inject:""`
	SQLStore *sqlstore.SqlStore `inject:""`
}

func (vds *VisitDashboardService) Init() error {
	vds.Bus.AddHandler(vds.VisitDashboard)
	return nil
}

func (vds *VisitDashboardService) VisitDashboard(cmd *models.VisitDashboardCommand) error {
	entry := models.DashboardVisit{
		UserId:      cmd.UserId,
		DashboardId: cmd.DashboardId,
		OrgId:       cmd.OrgId,
		VisitedAt:   time.Now(),
	}

	return vds.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		_, err := sess.Insert(&entry)
		return err
	})
}
