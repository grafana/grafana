package notifiers

import (
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/alerting"
)

type NotifierBase struct {
	Name     string
	Type     string
	Id       int64
	IsDeault bool
}

func NewNotifierBase(id int64, isDefault bool, name, notifierType string, model *simplejson.Json) NotifierBase {
	return NotifierBase{
		Id:       id,
		Name:     name,
		IsDeault: isDefault,
		Type:     notifierType,
	}
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

func (n *NotifierBase) GetNotifierId() int64 {
	return n.Id
}

func (n *NotifierBase) GetIsDefault() bool {
	return n.IsDeault
}
