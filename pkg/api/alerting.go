package api

import (
	"net/http"
	"slices"
	"strings"

	"github.com/grafana/alerting/notify"
	"github.com/grafana/alerting/receivers/schema"

	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func (hs *HTTPServer) GetAlertNotifiers() func(*contextmodel.ReqContext) response.Response {
	return func(r *contextmodel.ReqContext) response.Response {
		v2 := notify.GetSchemaForAllIntegrations()
		slices.SortFunc(v2, func(a, b schema.IntegrationTypeSchema) int {
			return strings.Compare(string(a.Type), string(b.Type))
		})
		if r.Query("version") == "2" {
			return response.JSON(http.StatusOK, v2)
		}

		type NotifierPlugin struct {
			Type        string  `json:"type"`
			TypeAlias   string  `json:"typeAlias,omitempty"`
			Name        string  `json:"name"`
			Heading     string  `json:"heading"`
			Description string  `json:"description"`
			Info        string  `json:"info"`
			Options     []Field `json:"options"`
		}

		result := make([]*NotifierPlugin, 0, len(v2))
		for _, s := range v2 {
			v1, ok := s.GetVersion(schema.V1)
			if !ok {
				continue
			}
			result = append(result, &NotifierPlugin{
				Type:        string(s.Type),
				Name:        s.Name,
				Description: s.Description,
				Heading:     s.Heading,
				Info:        s.Info,
				Options:     schemaFieldsToFields(s.Type, nil, v1.Options),
			})
		}
		return response.JSON(http.StatusOK, result)
	}
}

// TODO remove this when change is moved to schema

type Field struct {
	Element        schema.ElementType    `json:"element"`
	InputType      schema.InputType      `json:"inputType"`
	Label          string                `json:"label"`
	Description    string                `json:"description"`
	Placeholder    string                `json:"placeholder"`
	PropertyName   string                `json:"propertyName"`
	SelectOptions  []schema.SelectOption `json:"selectOptions"`
	ShowWhen       schema.ShowWhen       `json:"showWhen"`
	Required       bool                  `json:"required"`
	Protected      bool                  `json:"protected,omitempty"`
	ValidationRule string                `json:"validationRule"`
	Secure         bool                  `json:"secure"`
	DependsOn      string                `json:"dependsOn"`
	SubformOptions []Field               `json:"subformOptions"`
}

func schemaFieldsToFields(iType schema.IntegrationType, parent schema.IntegrationFieldPath, fields []schema.Field) []Field {
	if fields == nil {
		return nil
	}
	result := make([]Field, 0, len(fields))
	for _, f := range fields {
		result = append(result, schemaFieldToField(iType, parent, f))
	}
	return result
}

func schemaFieldToField(iType schema.IntegrationType, parent schema.IntegrationFieldPath, f schema.Field) Field {
	return Field{
		Element:        f.Element,
		InputType:      f.InputType,
		Label:          f.Label,
		Description:    f.Description,
		Placeholder:    f.Placeholder,
		PropertyName:   f.PropertyName,
		SelectOptions:  f.SelectOptions,
		ShowWhen:       f.ShowWhen,
		Required:       f.Required,
		ValidationRule: f.ValidationRule,
		Secure:         f.Secure,
		DependsOn:      f.DependsOn,
		SubformOptions: schemaFieldsToFields(iType, append(parent, f.PropertyName), f.SubformOptions),
		Protected:      models.IsProtectedField(iType, append(parent, f.PropertyName)),
	}
}
