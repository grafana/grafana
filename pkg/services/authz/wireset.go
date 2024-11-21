package authz

import (
	"github.com/google/wire"
)

var WireSet = wire.NewSet(
	ProvideInProcAuthZClient,
	ProvideZanzana,
)
