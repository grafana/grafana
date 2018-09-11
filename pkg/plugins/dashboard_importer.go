package plugins

import (
	"encoding/json"
	"fmt"
	"regexp"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
)

type ImportDashboardCommand struct {
	Dashboard *simplejson.Json
	Path      string
	Inputs    []ImportDashboardInput
	Overwrite bool
	FolderId  int64

	OrgId    int64
	User     *m.SignedInUser
	PluginId string
	Result   *PluginDashboardInfoDTO
}

type ImportDashboardInput struct {
	Type     string `json:"type"`
	PluginId string `json:"pluginId"`
	Name     string `json:"name"`
	Value    string `json:"value"`
}

type DashboardInputMissingError struct {
	VariableName string
}

func (e DashboardInputMissingError) Error() string {
	return fmt.Sprintf("Dashboard input variable: %v missing from import command", e.VariableName)
}

func init() {
	bus.AddHandler("plugins", ImportDashboard)
}

func ImportDashboard(cmd *ImportDashboardCommand) error {
	var dashboard *m.Dashboard
	var err error

	if cmd.PluginId != "" {
		if dashboard, err = loadPluginDashboard(cmd.PluginId, cmd.Path); err != nil {
			return err
		}
	} else {
		dashboard = m.NewDashboardFromJson(cmd.Dashboard)
	}

	evaluator := &DashTemplateEvaluator{
		template: dashboard.Data,
		inputs:   cmd.Inputs,
	}

	generatedDash, err := evaluator.Eval()
	if err != nil {
		return err
	}

	saveCmd := m.SaveDashboardCommand{
		Dashboard: generatedDash,
		OrgId:     cmd.OrgId,
		UserId:    cmd.User.UserId,
		Overwrite: cmd.Overwrite,
		PluginId:  cmd.PluginId,
		FolderId:  cmd.FolderId,
	}

	dto := &dashboards.SaveDashboardDTO{
		OrgId:     cmd.OrgId,
		Dashboard: saveCmd.GetDashboardModel(),
		Overwrite: saveCmd.Overwrite,
		User:      cmd.User,
	}

	savedDash, err := dashboards.NewService().ImportDashboard(dto)

	if err != nil {
		return err
	}

	cmd.Result = &PluginDashboardInfoDTO{
		PluginId:         cmd.PluginId,
		Title:            savedDash.Title,
		Path:             cmd.Path,
		Revision:         savedDash.Data.Get("revision").MustInt64(1),
		FolderId:         savedDash.FolderId,
		ImportedUri:      "db/" + savedDash.Slug,
		ImportedUrl:      savedDash.GetUrl(),
		ImportedRevision: dashboard.Data.Get("revision").MustInt64(1),
		Imported:         true,
	}

	return nil
}

type DashTemplateEvaluator struct {
	template  *simplejson.Json
	inputs    []ImportDashboardInput
	variables map[string]string
	result    *simplejson.Json
	varRegex  *regexp.Regexp
}

func (this *DashTemplateEvaluator) findInput(varName string, varType string) *ImportDashboardInput {

	for _, input := range this.inputs {
		if varType == input.Type && (input.Name == varName || input.Name == "*") {
			return &input
		}
	}

	return nil
}

func (this *DashTemplateEvaluator) Eval() (*simplejson.Json, error) {
	this.result = simplejson.New()
	this.variables = make(map[string]string)
	this.varRegex, _ = regexp.Compile(`(\$\{.+\})`)

	// check that we have all inputs we need
	for _, inputDef := range this.template.Get("__inputs").MustArray() {
		inputDefJson := simplejson.NewFromAny(inputDef)
		inputName := inputDefJson.Get("name").MustString()
		inputType := inputDefJson.Get("type").MustString()
		input := this.findInput(inputName, inputType)

		if input == nil {
			return nil, &DashboardInputMissingError{VariableName: inputName}
		}

		this.variables["${"+inputName+"}"] = input.Value
	}

	return simplejson.NewFromAny(this.evalObject(this.template)), nil
}

func (this *DashTemplateEvaluator) evalValue(source *simplejson.Json) interface{} {

	sourceValue := source.Interface()

	switch v := sourceValue.(type) {
	case string:
		interpolated := this.varRegex.ReplaceAllStringFunc(v, func(match string) string {
			replacement, exists := this.variables[match]
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
		return this.evalObject(source)
	case []interface{}:
		array := make([]interface{}, 0)
		for _, item := range v {
			array = append(array, this.evalValue(simplejson.NewFromAny(item)))
		}
		return array
	}

	return nil
}

func (this *DashTemplateEvaluator) evalObject(source *simplejson.Json) interface{} {
	result := make(map[string]interface{})

	for key, value := range source.MustMap() {
		if key == "__inputs" {
			continue
		}
		result[key] = this.evalValue(simplejson.NewFromAny(value))
	}

	return result
}
