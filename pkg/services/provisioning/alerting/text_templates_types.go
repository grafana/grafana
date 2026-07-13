package alerting

import (
	"errors"
	"strings"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	alerting_models "github.com/grafana/grafana/pkg/services/ngalert/models"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
	"github.com/grafana/grafana/pkg/services/provisioning/values"
)

type TemplateV1 struct {
	OrgID    values.Int64Value                `json:"orgId" yaml:"orgId"`
	Template definitions.NotificationTemplate `json:",inline" yaml:",inline"`
}

func (t *TemplateV1) mapToModel() Template {
	orgID := t.OrgID.Value()
	if orgID < 1 {
		orgID = 1
	}
	return Template{
		Data: v1.TemplateGroup{
			Title:   t.Template.Name,
			Content: t.Template.Template,
			Kind:    v1.TemplateKindGrafana,
			ResourceMetadata: v1.ResourceMetadata{
				Provenance: alerting_models.ProvenanceFile,
			},
		},
		OrgID: orgID,
	}
}

type Template struct {
	OrgID int64
	Data  v1.TemplateGroup
}

type DeleteTemplateV1 struct {
	OrgID values.Int64Value  `json:"orgId" yaml:"orgId"`
	Name  values.StringValue `json:"name" yaml:"name"`
}

func (v1 *DeleteTemplateV1) mapToModel() (DeleteTemplate, error) {
	name := strings.TrimSpace(v1.Name.Value())
	if name == "" {
		return DeleteTemplate{}, errors.New("delete template missing name")
	}
	orgID := v1.OrgID.Value()
	if orgID < 1 {
		orgID = 1
	}
	return DeleteTemplate{
		Name:  name,
		OrgID: orgID,
	}, nil
}

type DeleteTemplate struct {
	OrgID int64
	Name  string
}
