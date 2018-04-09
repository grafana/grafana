package initialization

import (
	"context"

	"github.com/go-xorm/xorm"
	"github.com/grafana/grafana/pkg/services/dashboards"
	ini "gopkg.in/ini.v1"
)

type SetDashboardProvisioningService interface {
	SetDashboardProvisioningService(dashboards.DashboardProvisioningService)
}

type Service interface {
	Init(ctx context.Context, engine *xorm.Engine, settings *ini.File) error
	Run() error
}
