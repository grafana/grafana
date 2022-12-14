package channels

// Base is the base implementation of a notifier. It contains the common fields across all notifier types.
type Base struct {
	Name                  string
	Type                  string
	UID                   string
	IsDefault             bool
	DisableResolveMessage bool
}

func (n *Base) GetDisableResolveMessage() bool {
	return n.DisableResolveMessage
}

func NewBase(uid, name, notifierType string, isDefault, DisableResolveMessage bool) *Base {
	return &Base{
		UID:                   uid,
		Name:                  name,
		IsDefault:             isDefault,
		Type:                  notifierType,
		DisableResolveMessage: DisableResolveMessage,
	}
}
