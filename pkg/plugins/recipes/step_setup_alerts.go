package recipes

import "github.com/grafana/grafana/pkg/models"

func newSetupAlertsStep(meta RecipeStepMeta, alerts []AlertRule) *setupAlertsStep {
	return &setupAlertsStep{
		Action: "setup-alerts",
		Meta:   meta,
		Settings: &alertsSettings{
			Alerts: alerts,
		},
	}
}

type AlertRule struct {
	Name      string `json:"name"`
	Group     string `json:"group"`
	Namespace string `json:"namespace"`
	Summary   string `json:"summary"`
}

type alertsSettings struct {
	Alerts []AlertRule `json:"alerts"`
}

type setupAlertsStep struct {
	Action   string          `json:"action"`
	Meta     RecipeStepMeta  `json:"meta"`
	Settings *alertsSettings `json:"settings"`
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

func (s *setupAlertsStep) ToDto(c *models.ReqContext) *RecipeStepDTO {
	status, err := s.Status(c)

	return &RecipeStepDTO{
		Action:      s.Action,
		Name:        s.Meta.Name,
		Description: s.Meta.Description,
		Status:      *status.ToDto(err),
		Settings:    s.Settings,
	}
}
