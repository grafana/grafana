package manager

import (
	"encoding/json"
	"fmt"
	"regexp"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/dashboards"
)

var varRegex = regexp.MustCompile(`(\$\{.+?\})`)

type DashboardInputMissingError struct {
	VariableName string
}

func (e DashboardInputMissingError) Error() string {
	return fmt.Sprintf("Dashboard input variable: %v missing from import command", e.VariableName)
}

func (pm *PluginManager) ImportDashboard(pluginID, path string, orgID, folderID int64, dashboardModel *simplejson.Json,
	overwrite bool, inputs []plugins.ImportDashboardInput, user *models.SignedInUser,
	requestHandler plugins.DataRequestHandler) (plugins.PluginDashboardInfoDTO, *models.Dashboard, error) {
	var dashboard *models.Dashboard
	if pluginID != "" {
		var err error
		if dashboard, err = pm.LoadPluginDashboard(pluginID, path); err != nil {
			return plugins.PluginDashboardInfoDTO{}, &models.Dashboard{}, err
		}
	} else {
		dashboard = models.NewDashboardFromJson(dashboardModel)
	}

	evaluator := &DashTemplateEvaluator{
		template: dashboard.Data,
		inputs:   inputs,
	}

	generatedDash, err := evaluator.Eval()
	if err != nil {
		return plugins.PluginDashboardInfoDTO{}, &models.Dashboard{}, err
	}

	saveCmd := models.SaveDashboardCommand{
		Dashboard: generatedDash,
		OrgId:     orgID,
		UserId:    user.UserId,
		Overwrite: overwrite,
		PluginId:  pluginID,
		FolderId:  folderID,
	}

	dto := &dashboards.SaveDashboardDTO{
		OrgId:     orgID,
		Dashboard: saveCmd.GetDashboardModel(),
		Overwrite: saveCmd.Overwrite,
		User:      user,
	}

	savedDash, err := dashboards.NewService(pm.SQLStore).ImportDashboard(dto)
	if err != nil {
		return plugins.PluginDashboardInfoDTO{}, &models.Dashboard{}, err
	}

	return plugins.PluginDashboardInfoDTO{
		PluginId:         pluginID,
		Title:            savedDash.Title,
		Path:             path,
		Revision:         savedDash.Data.Get("revision").MustInt64(1),
		FolderId:         savedDash.FolderId,
		ImportedUri:      "db/" + savedDash.Slug,
		ImportedUrl:      savedDash.GetUrl(),
		ImportedRevision: dashboard.Data.Get("revision").MustInt64(1),
		Imported:         true,
		DashboardId:      savedDash.Id,
		Slug:             savedDash.Slug,
	}, savedDash, nil
}

type DashTemplateEvaluator struct {
	template  *simplejson.Json
	inputs    []plugins.ImportDashboardInput
	variables map[string]string
	result    *simplejson.Json
}

func (e *DashTemplateEvaluator) findInput(varName string, varType string) *plugins.ImportDashboardInput {
	for _, input := range e.inputs {
		if varType == input.Type && (input.Name == varName || input.Name == "*") {
			return &input
		}
	}

	return nil
}

func (e *DashTemplateEvaluator) Eval() (*simplejson.Json, error) {
	e.result = simplejson.New()
	e.variables = make(map[string]string)

	// check that we have all inputs we need
	for _, inputDef := range e.template.Get("__inputs").MustArray() {
		inputDefJson := simplejson.NewFromAny(inputDef)
		inputName := inputDefJson.Get("name").MustString()
		inputType := inputDefJson.Get("type").MustString()
		input := e.findInput(inputName, inputType)

		if input == nil {
			return nil, &DashboardInputMissingError{VariableName: inputName}
		}

		e.variables["${"+inputName+"}"] = input.Value
	}

	return simplejson.NewFromAny(e.evalObject(e.template)), nil
}

func (e *DashTemplateEvaluator) evalValue(source *simplejson.Json) interface{} {
	sourceValue := source.Interface()

	switch v := sourceValue.(type) {
	case string:
		interpolated := varRegex.ReplaceAllStringFunc(v, func(match string) string {
			replacement, exists := e.variables[match]
			if exists {
				return replacement
			}
			return match
		})
		return interpolated
	case bool:
		return v
	case json.Number:
		return v
	case map[string]interface{}:
		return e.evalObject(source)
	case []interface{}:
		array := make([]interface{}, 0)
		for _, item := range v {
			array = append(array, e.evalValue(simplejson.NewFromAny(item)))
		}
		return array
	}

	return nil
}

func (e *DashTemplateEvaluator) evalObject(source *simplejson.Json) interface{} {
	result := make(map[string]interface{})

	for key, value := range source.MustMap() {
		if key == "__inputs" {
			continue
		}
		result[key] = e.evalValue(simplejson.NewFromAny(value))
	}

	return result
}
