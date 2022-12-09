package recipes

import "github.com/grafana/grafana/pkg/models"

func newInstallAgentStep(settings *installAgentSettings) *installAgentStep {
	return &installAgentStep{
		Action: "install-agent",
		Meta: RecipeStepMeta{
			Status:      NotCompleted,
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
	s.Meta.Status = Completed

	return nil
}

func (s *installAgentStep) Revert(c *models.ReqContext) error {
	s.Meta.Status = NotCompleted

	return nil
}

func (s *installAgentStep) Status(c *models.ReqContext) (StepStatus, error) {
	return s.Meta.Status, nil
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
