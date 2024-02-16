// Code generated - EDITING IS FUTILE. DO NOT EDIT.
//
// Using jennies:
//     GoRuntime

package cog

import (
	"encoding/json"

	cogvariants "github.com/grafana/grafana/pkg/kinds/cog/variants"
)

var runtimeInstance *Runtime

type Runtime struct {
	panelcfgVariants  map[string]cogvariants.PanelcfgConfig
	dataqueryVariants map[string]cogvariants.DataqueryConfig
}

func NewRuntime() *Runtime {
	if runtimeInstance != nil {
		return runtimeInstance
	}

	runtimeInstance = &Runtime{
		panelcfgVariants:  make(map[string]cogvariants.PanelcfgConfig),
		dataqueryVariants: make(map[string]cogvariants.DataqueryConfig),
	}

	return runtimeInstance
}

func (runtime *Runtime) RegisterPanelcfgVariant(config cogvariants.PanelcfgConfig) {
	runtime.panelcfgVariants[config.Identifier] = config
}

func (runtime *Runtime) ConfigForPanelcfgVariant(identifier string) (cogvariants.PanelcfgConfig, bool) {
	config, found := runtime.panelcfgVariants[identifier]

	return config, found
}

func (runtime *Runtime) RegisterDataqueryVariant(config cogvariants.DataqueryConfig) {
	runtime.dataqueryVariants[config.Identifier] = config
}

func (runtime *Runtime) UnmarshalDataqueryArray(raw []byte, dataqueryTypeHint string) ([]cogvariants.Dataquery, error) {
	rawDataqueries := []json.RawMessage{}
	if err := json.Unmarshal(raw, &rawDataqueries); err != nil {
		return nil, err
	}

	dataqueries := make([]cogvariants.Dataquery, 0, len(rawDataqueries))
	for _, rawDataquery := range rawDataqueries {
		dataquery, err := runtime.UnmarshalDataquery(rawDataquery, dataqueryTypeHint)
		if err != nil {
			return nil, err
		}

		dataqueries = append(dataqueries, dataquery)
	}

	return dataqueries, nil
}

func (runtime *Runtime) UnmarshalDataquery(raw []byte, dataqueryTypeHint string) (cogvariants.Dataquery, error) {
	// A hint tells us the dataquery type: let's use it.
	if dataqueryTypeHint != "" {
		config, found := runtime.dataqueryVariants[dataqueryTypeHint]
		if found {
			dataquery, err := config.DataqueryUnmarshaler(raw)
			if err != nil {
				return nil, err
			}

			return dataquery.(cogvariants.Dataquery), nil
		}
	}

	// We have no idea what type the dataquery is: use our `UnknownDataquery` bag to not lose data.
	dataquery := cogvariants.UnknownDataquery{}
	if err := json.Unmarshal(raw, &dataquery); err != nil {
		return nil, err
	}

	return dataquery, nil
}

func UnmarshalDataqueryArray(raw []byte, dataqueryTypeHint string) ([]cogvariants.Dataquery, error) {
	return NewRuntime().UnmarshalDataqueryArray(raw, dataqueryTypeHint)
}

func UnmarshalDataquery(raw []byte, dataqueryTypeHint string) (cogvariants.Dataquery, error) {
	return NewRuntime().UnmarshalDataquery(raw, dataqueryTypeHint)
}

func ConfigForPanelcfgVariant(identifier string) (cogvariants.PanelcfgConfig, bool) {
	return NewRuntime().ConfigForPanelcfgVariant(identifier)
}
