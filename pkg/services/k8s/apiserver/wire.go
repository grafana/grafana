package apiserver

import (
	"github.com/google/wire"
)

var WireSet = wire.NewSet(
	ProvideRESTOptionsGetter,
)
