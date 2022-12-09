package recipes

import (
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/datasources"
)

func newSetupDatasourceStep(ds datasources.DataSourceService, settings *datasourceSettings) *setupDatasourceStep {
	return &setupDatasourceStep{
		Action: "setup-datasource",
		Meta: RecipeStepMeta{
			Status:      NotCompleted,
			Name:        fmt.Sprintf("Configuring %s data source", settings.Type),
			Description: fmt.Sprintf("Configuring so Grafana can connect to the %s instance to query data", settings.Type),
		},
		Settings: *settings,
		ds:       ds,
	}
}

// TODO: add fields needed to setup datasource
type datasourceSettings struct {
	Name      string `json:"name"`
	Type      string `json:"type"`
	Access    string `json:"access"`
	Url       string `json:"url"`
	BasicAuth bool   `json:"basicAuth"`
}

type setupDatasourceStep struct {
	Action   string         `json:"action"`
	Meta     RecipeStepMeta `json:"meta"`
	Settings datasourceSettings
	ds       datasources.DataSourceService
}

func (s *setupDatasourceStep) Apply(c *models.ReqContext) error {
	status, err := s.Status(c)
	if err != nil {
		return err
	}
	if status == Completed {
		return nil
	}

	// TODO: map config to AddDataSourceCommand
	cmd := datasources.AddDataSourceCommand{
		UserId:    c.UserID,
		OrgId:     c.OrgID,
		Type:      s.Settings.Type,
		Name:      s.Settings.Name,
		Access:    datasources.DsAccess(s.Settings.Access),
		Url:       s.Settings.Url,
		BasicAuth: s.Settings.BasicAuth,
		ReadOnly:  true,
	}

	if err := s.ds.AddDataSource(c.Req.Context(), &cmd); err != nil {
		if errors.Is(err, datasources.ErrDataSourceNameExists) || errors.Is(err, datasources.ErrDataSourceUidExists) {
			return err
		}
		return err
	}

	s.Meta.Status = Completed

	return nil
}

func (s *setupDatasourceStep) Revert(c *models.ReqContext) error {
	status, err := s.Status(c)
	if err != nil {
		return err
	}

	if status == NotCompleted {
		return nil
	}

	cmd := &datasources.DeleteDataSourceCommand{Name: s.Settings.Name, OrgID: c.OrgID}
	if err := s.ds.DeleteDataSource(c.Req.Context(), cmd); err != nil {
		return err
	}

	s.Meta.Status = NotCompleted

	return nil
}

// TODO: instead of detecting if there is a datasource existing with a given name, should we perist the ID of the created datasource instead?
// (It can happen that there are multiple datasources with the same name querying different services / endpoints.)
func (s *setupDatasourceStep) Status(c *models.ReqContext) (StepStatus, error) {
	query := datasources.GetDataSourceQuery{Name: s.Settings.Name, OrgId: c.OrgID}

	if err := s.ds.GetDataSource(c.Req.Context(), &query); err != nil {
		if errors.Is(err, datasources.ErrDataSourceNotFound) {
			return NotCompleted, nil
		}
		return Error, err
	}

	return Completed, nil
}

func (s *setupDatasourceStep) ToDto(c *models.ReqContext) *RecipeStepDTO {
	status, err := s.Status(c)

	return &RecipeStepDTO{
		Action:      s.Action,
		Name:        s.Meta.Name,
		Description: s.Meta.Description,
		Status:      *status.ToDto(err),
		Settings:    s.Settings,
	}
}
