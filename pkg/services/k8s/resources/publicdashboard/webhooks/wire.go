package webhooks

import "github.com/google/wire"

var WireSet = wire.NewSet(
	ProvideWebhooks,
)
