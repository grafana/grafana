package recipes

import "github.com/grafana/grafana/pkg/models"

func newInstallAgentStep(settings *installAgentSettings) *installAgentStep {
	return &installAgentStep{
		Action: "install-agent",
		Meta: RecipeStepMeta{
			Name:        "Installing Grafana agent on server",
			Description: "Grafana agent is used to collect and ship metrics to Prometheus",
		},
		Settings: settings,
	}
}

type AgentMetrics struct {
	Name        string `json:"name"`
	Type        string `json:"type"`
	Description string `json:"description"`
}

type installAgentStep struct {
	Action   string                `json:"action"`
	Meta     RecipeStepMeta        `json:"meta"`
	Settings *installAgentSettings `json:"settings"`
}

type installAgentSettings struct {
	Metrics []AgentMetrics `json:"metrics"`
}

func (s *installAgentStep) Apply(c *models.ReqContext) error {
	return nil
}

func (s *installAgentStep) Revert(c *models.ReqContext) error {
	return nil
}

func (s *installAgentStep) Status(c *models.ReqContext) (StepStatus, error) {
	return Completed, nil
}

func (s *installAgentStep) ToDto(c *models.ReqContext) *RecipeStepDTO {
	status, err := s.Status(c)

	return &RecipeStepDTO{
		Action:      s.Action,
		Name:        s.Meta.Name,
		Description: s.Meta.Description,
		Status:      *status.ToDto(err),
		Settings:    s.Settings,
	}
}
