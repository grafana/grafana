package channels

import (
	"github.com/grafana/grafana/pkg/models"
)

// Base is the base implementation of a notifier. It contains the common fields across all notifier types.
type Base struct {
	Name                  string
	Type                  string
	UID                   string
	IsDefault             bool
	DisableResolveMessage bool

	// log log.Logger
}

func (n *Base) GetDisableResolveMessage() bool {
	return n.DisableResolveMessage
}

func NewBase(model *models.AlertNotification) *Base {
	return &Base{
		UID:                   model.Uid,
		Name:                  model.Name,
		IsDefault:             model.IsDefault,
		Type:                  model.Type,
		DisableResolveMessage: model.DisableResolveMessage,
		// log:                   log.New("alerting.notifier." + model.Name),
	}
}
