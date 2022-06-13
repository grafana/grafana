package frontendlogging

import (
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
)

var grafanaJavascriptAgentLogger = log.New("frontendlogging")

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
func (event *FrontendGrafanaJavascriptAgentEvent) ToGrafanJavascriptAgentLogContext() []interface{} {
	var ctx = CtxVector{}
	for k, v := range KeyValToInterfaceMap(event.Meta.KeyVal()) {
		ctx = append(ctx, k, v)
	}

	//@FIXME - deal with multiple exceptions
	for _, exception := range event.Exceptions {
		transformedException := TransformException(&exception)
		ctx = append(ctx, "exception", transformedException)
	}

	return ctx
}
