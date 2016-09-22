package notifiers

import (
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/alerting"
)

type NotifierBase struct {
	Name string
	Type string
}

func NewNotifierBase(name, notifierType string, model *simplejson.Json) NotifierBase {
	base := NotifierBase{Name: name, Type: notifierType}
	return base
}

func (n *NotifierBase) PassesFilter(rule *alerting.Rule) bool {
	return true
}

func (n *NotifierBase) GetType() string {
	return n.Type
}

func (n *NotifierBase) NeedsImage() bool {
	return true
}
