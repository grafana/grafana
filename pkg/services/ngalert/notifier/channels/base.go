package channels

// Base is the base implementation of a notifier. It contains the common fields across all notifier types.
type Base struct {
	Name                  string
	Type                  string
	UID                   string
	DisableResolveMessage bool
}

func (n *Base) GetDisableResolveMessage() bool {
	return n.DisableResolveMessage
}

func NewBase(cfg *NotificationChannelConfig) *Base {
	return &Base{
		UID:                   cfg.UID,
		Name:                  cfg.Name,
		Type:                  cfg.Type,
		DisableResolveMessage: cfg.DisableResolveMessage,
	}
}
