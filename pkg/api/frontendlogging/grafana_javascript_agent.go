package frontendlogging

import (
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

func (event *FrontendGrafanaJavascriptAgentEvent) ToGrafanJavascriptAgentLogContext() []interface{} {

	//grafanaJavascriptAgentLogger.Info("Here is the event", spew.Sdump(event))
	var ctx = CtxVector{}
	// if event.Exception != "" {
	// 	//ctx = append(ctx, "stacktrace", event.Exception.FmtStacktraces())
	// }
	//addEventContextToLogContext("context", &ctx, event.Contexts)
	return ctx
}
