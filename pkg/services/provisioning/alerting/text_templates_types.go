package alerting

import (
	"errors"
	"strings"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/provisioning/values"
)

type TemplateV1 struct {
	OrgID    values.Int64Value                `json:"orgId" yaml:"orgId"`
	Template definitions.NotificationTemplate `json:",inline" yaml:",inline"`
}

func (v1 *TemplateV1) mapToModel() Template {
	orgID := v1.OrgID.Value()
	if orgID < 1 {
		orgID = 1
	}
	return Template{
		Data:  v1.Template,
		OrgID: orgID,
	}
}

type Template struct {
	OrgID int64
	Data  definitions.NotificationTemplate
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
