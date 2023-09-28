package accesscontrol

import "github.com/google/wire"

var WireSet = wire.NewSet(
	ProvideAccessControlAuthorizer,
)
