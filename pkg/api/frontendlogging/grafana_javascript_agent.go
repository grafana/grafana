package frontendlogging

import (
	"fmt"
)

type CtxVector []interface{}

type FrontendGrafanaJavascriptAgentEvent struct {
	Exceptions   []Exception   `json:"exceptions,omitempty"`
	Logs         []Log         `json:"logs,omitempty"`
	Measurements []Measurement `json:"measurements,omitempty"`
	Meta         Meta          `json:"meta,omitempty"`
	Traces       *Traces       `json:"traces,omitempty"`
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
