package authn

import (
	"github.com/google/wire"
)

var WireSet = wire.NewSet(
	ProvideService,
	wire.Bind(new(K8sAuthnAPI), new(*K8sAuthnAPIImpl)),
)
