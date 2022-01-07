package dashboards

import (
	"time"

	"github.com/grafana/grafana/pkg/models"
)

type SaveDashboardDTO struct {
	OrgId     int64
	UpdatedAt time.Time
	User      *models.SignedInUser
	Message   string
	Overwrite bool
	Dashboard *models.Dashboard
}
