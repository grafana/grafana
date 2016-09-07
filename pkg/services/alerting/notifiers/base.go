package notifiers

import (
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
)

type NotifierBase struct {
	Name           string
	Type           string
	SeverityFilter models.AlertSeverityType
}

func NewNotifierBase(name, notifierType string, model *simplejson.Json) NotifierBase {
	base := NotifierBase{Name: name, Type: notifierType}

	severityFilter := models.AlertSeverityType(model.Get("severityFilter").MustString(""))

	if severityFilter == models.AlertSeverityCritical || severityFilter == models.AlertSeverityWarning {
		base.SeverityFilter = severityFilter
	}

	return base
}

func (n *NotifierBase) MatchSeverity(result models.AlertSeverityType) bool {
	if !n.SeverityFilter.IsValid() {
		return true
	}

	return n.SeverityFilter == result
}

func (n *NotifierBase) GetType() string {
	return n.Type
}

func (n *NotifierBase) NeedsImage() bool {
	return true
}
