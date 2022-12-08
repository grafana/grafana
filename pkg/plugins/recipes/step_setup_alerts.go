package recipes

import "github.com/grafana/grafana/pkg/models"

func newSetupAlertsStep(meta RecipeStepMeta, alerts []AlertRule) *setupAlertsStep {
	meta.Status = NotCompleted

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
	s.Meta.Status = Completed
	return nil
}

// TODO: remove alert
func (s *setupAlertsStep) Revert(c *models.ReqContext) error {
	s.Meta.Status = NotCompleted
	return nil
}

// TODO: check here if the alert has already been added, maybe that's more sophisticated
func (s *setupAlertsStep) Status(c *models.ReqContext) (StepStatus, error) {
	return s.Meta.Status, nil
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
