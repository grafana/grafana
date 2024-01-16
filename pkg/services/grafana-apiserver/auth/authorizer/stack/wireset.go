package stack

import "github.com/google/wire"

var WireSet = wire.NewSet(
	ProvideStackIDAuthorizer,
)
