package recipes

import (
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
)

func newSetupDashboardStep(ds dashboards.DashboardService, meta RecipeStepMeta, settings *dashboardSettings) *dashboardStep {
	meta.Status = NotCompleted

	return &dashboardStep{
		Action:   "setup-dashboard",
		Meta:     meta,
		ds:       ds,
		Settings: settings,
	}
}

type dashboardSettings struct {
	Name        string
	Screenshots []RecipeStepScreenshot `json:"screenshots"`
}

type dashboardStep struct {
	Action   string
	Meta     RecipeStepMeta
	Settings *dashboardSettings
	ds       dashboards.DashboardService
}

func (s *dashboardStep) Apply(c *models.ReqContext) error {
	// TODO: map step config to command
	cmd := models.SaveDashboardCommand{
		OrgId:  c.OrgID,
		UserId: c.UserID,
	}

	// TODO: add logic to setup folder if missing

	d := &dashboards.SaveDashboardDTO{
		Dashboard: cmd.GetDashboardModel(),
		Message:   cmd.Message,
		OrgId:     c.OrgID,
		User:      c.SignedInUser,
		Overwrite: cmd.Overwrite,
	}

	if _, err := s.ds.SaveDashboard(c.Req.Context(), d, true); err != nil {
		return err
	}

	s.Meta.Status = Completed

	return nil
}

// TODO: delete dashboard
func (s *dashboardStep) Revert(c *models.ReqContext) error {
	s.Meta.Status = NotCompleted

	return nil
}

func (s *dashboardStep) Status(c *models.ReqContext) (StepStatus, error) {
	return s.Meta.Status, nil
}

func (s *dashboardStep) ToDto(c *models.ReqContext) *RecipeStepDTO {
	status, err := s.Status(c)

	return &RecipeStepDTO{
		Action:      s.Action,
		Name:        s.Meta.Name,
		Description: s.Meta.Description,
		Status:      *status.ToDto(err),
		Settings:    s.Settings,
	}
}
