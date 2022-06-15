package frontendlogging

import (
	"fmt"
)

type FrontendGrafanaJavascriptAgentEvent struct {
	Exceptions   []Exception   `json:"exceptions,omitempty"`
	Logs         []Log         `json:"logs,omitempty"`
	Measurements []Measurement `json:"measurements,omitempty"`
	Meta         Meta          `json:"meta,omitempty"`
	Traces       *Traces       `json:"traces,omitempty"`
}

// KeyValToInterfaceSlice converts KeyVal to []interface{}, typically used for logging
func KeyValToInterfaceSlice(kv *KeyVal) []interface{} {
	slice := make([]interface{}, kv.Len()*2)
	idx := 0
	for el := kv.Oldest(); el != nil; el = el.Next() {
		slice[idx] = el.Key
		idx++
		slice[idx] = el.Value
		idx++
	}
	return slice
}

// KeyValToInterfaceMap converts KeyVal to map[string]interface
func KeyValToInterfaceMap(kv *KeyVal) map[string]interface{} {
	retv := make(map[string]interface{})
	for el := kv.Oldest(); el != nil; el = el.Next() {
		retv[fmt.Sprint(el.Key)] = el.Value
	}
	return retv
}
func (event *FrontendGrafanaJavascriptAgentEvent) AddMetaToContext(ctx CtxVector) []interface{} {
	for k, v := range KeyValToInterfaceMap(event.Meta.KeyVal()) {
		ctx = append(ctx, k, v)
	}
	return ctx
}

func (event *FrontendGrafanaJavascriptAgentEvent) ConvertMeasurementsToInterfaceMap() map[string]interface{} {
	interfaceMap := make(map[string]interface{})
	if event.Measurements != nil && len(event.Measurements) > 0 {
		for _, measurement := range event.Measurements {
			if measurement.Type != "" {
				interfaceMap[measurement.Type] = KeyValToInterfaceSlice(measurement.KeyVal())
			}
		}
	}
	return interfaceMap
}
