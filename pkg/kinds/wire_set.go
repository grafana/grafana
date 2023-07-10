package kinds

import "github.com/google/wire"

var WireSet = wire.NewSet(
	NewCatalog,
)
