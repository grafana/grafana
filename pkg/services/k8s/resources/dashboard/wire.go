package dashboard

import (
	"github.com/google/wire"
)

var WireSet = wire.NewSet(
	ProvideWatcher,      // unstructured
	ProvideStoreWrapper, // Replace the original store with a wrapper
)
