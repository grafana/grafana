package authz

import (
	"github.com/google/wire"
)

// WireSetBase contains the authz providers that are stable across OSS and
// enterprise builds. Enterprise wirings should include WireSetBase (not
// WireSet) so they can rebind overridable providers such as the reconciler
// CRD list.
var WireSetBase = wire.NewSet(
	ProvideAuthZClient,
	ProvideZanzanaClient,
	ProvideEmbeddedZanzanaServer,
	ProvideEmbeddedZanzanaService,
)
