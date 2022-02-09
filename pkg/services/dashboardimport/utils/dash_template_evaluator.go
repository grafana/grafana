package utils

import (
	"encoding/json"
	"fmt"
	"regexp"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/services/dashboardimport"
)

var varRegex = regexp.MustCompile(`(\$\{.+?\})`)

type DashboardInputMissingError struct {
	VariableName string
}

func (e DashboardInputMissingError) Error() string {
	return fmt.Sprintf("Dashboard input variable: %v missing from import command", e.VariableName)
}

type DashTemplateEvaluator struct {
	template  *simplejson.Json
	inputs    []dashboardimport.ImportDashboardInput
	variables map[string]string
	result    *simplejson.Json
}

func NewDashTemplateEvaluator(template *simplejson.Json, inputs []dashboardimport.ImportDashboardInput) *DashTemplateEvaluator {
	return &DashTemplateEvaluator{
		template: template,
		inputs:   inputs,
	}
}

func (e *DashTemplateEvaluator) findInput(varName string, varType string) *dashboardimport.ImportDashboardInput {
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

		// force expressions value to `__expr__`
		if inputDefJson.Get("pluginId").MustString() == expr.DatasourceType {
			input = &dashboardimport.ImportDashboardInput{
				Value: expr.DatasourceType,
			}
		}

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
