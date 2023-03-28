package authnz

import (
	"github.com/google/wire"
)

var WireSet = wire.NewSet(
	ProvideAuthn,
	wire.Bind(new(K8sAuthnAPI), new(*K8sAuthnAPIImpl)),
	ProvideAuthz,
	wire.Bind(new(K8sAuthzAPI), new(*K8sAuthzAPIImpl)),
)
