package authz

import (
	"github.com/google/wire"
)

var WireSet = wire.NewSet(
	ProvideService,
	wire.Bind(new(K8sAuthzAPI), new(*K8sAuthzAPIImpl)),
)
