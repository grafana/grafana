package alerting

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
)

type TextTemplateProvisioner interface {
	Provision(ctx context.Context, files []*AlertingFile) error
	Unprovision(ctx context.Context, files []*AlertingFile) error
}

type defaultTextTemplateProvisioner struct {
	logger          log.Logger
	templateService provisioning.TemplateService
}

func NewTextTemplateProvisioner(logger log.Logger,
	templateService provisioning.TemplateService) TextTemplateProvisioner {
	return &defaultTextTemplateProvisioner{
		logger:          logger,
		templateService: templateService,
	}
}

func (c *defaultTextTemplateProvisioner) Provision(ctx context.Context,
	files []*AlertingFile) error {
	for _, file := range files {
		for _, template := range file.Templates {
			template.Data.Provenance = definitions.Provenance(models.ProvenanceFile)
			_, err := c.templateService.SetTemplate(ctx, template.OrgID, template.Data)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func (c *defaultTextTemplateProvisioner) Unprovision(ctx context.Context,
	files []*AlertingFile) error {
	for _, file := range files {
		for _, deleteTemplate := range file.DeleteTemplates {
			err := c.templateService.DeleteTemplate(ctx, deleteTemplate.OrgID, deleteTemplate.Name)
			if err != nil {
				return err
			}
		}
	}
	return nil
}
