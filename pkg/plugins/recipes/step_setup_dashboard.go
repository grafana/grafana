package recipes

import (
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
)

func newSetupDashboardStep(ds dashboards.DashboardService, meta dashboardStepMeta) *dashboardStep {
	return &dashboardStep{
		Action: "setup-dashboard",
		Meta:   meta,
		ds:     ds,
	}
}

type dashboardStepMeta struct {
	RecipeStepMeta
	Screenshots []RecipeStepScreenshot `json:"screenshots"`
}

type dashboardStep struct {
	Action string            `json:"action"`
	Meta   dashboardStepMeta `json:"meta"`
	ds     dashboards.DashboardService
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

	return nil
}

func (s *dashboardStep) Revert(c *models.ReqContext) error {
	return nil
}

func (s *dashboardStep) Status(c *models.ReqContext) (StepStatus, error) {
	return Completed, nil
}
