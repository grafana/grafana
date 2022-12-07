package recipes

import "github.com/grafana/grafana/pkg/models"

func newSetupAlertsStep(meta RecipeStepMeta, alerts []AlertRule) *setupAlertsStep {
	return &setupAlertsStep{
		Action: "setup-alerts",
		Meta:   meta,
		Alerts: alerts,
	}
}

type AlertRule struct {
	Name      string `json:"name"`
	Group     string `json:"group"`
	Namespace string `json:"namespace"`
	Summary   string `json:"summary"`
}

type setupAlertsStep struct {
	Action string         `json:"action"`
	Meta   RecipeStepMeta `json:"meta"`
	Alerts []AlertRule    `json:"alerts"`
}

func (s *setupAlertsStep) Apply(c *models.ReqContext) error {
	return nil
}

func (s *setupAlertsStep) Revert(c *models.ReqContext) error {
	return nil
}

func (s *setupAlertsStep) Status(c *models.ReqContext) (StepStatus, error) {
	return Completed, nil
}
