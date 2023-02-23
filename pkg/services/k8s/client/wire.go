package client

import "github.com/google/wire"

var WireSet = wire.NewSet(ProvideClientset, ProvideRESTConfig)
