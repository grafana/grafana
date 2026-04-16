package authz

import (
	"github.com/google/wire"
)

// WireSetBase contains the authz providers that are stable across OSS and
// enterprise builds. Enterprise wirings should include WireSetBase (not
// WireSet) so they can rebind overridable providers such as the reconciler
// GVR list.
var WireSetBase = wire.NewSet(
	ProvideAuthZClient,
	ProvideZanzanaClient,
	ProvideEmbeddedZanzanaServer,
	ProvideEmbeddedZanzanaService,
)

// WireSet is the default OSS wiring: WireSetBase plus the OSS default
// ProvideReconcileGVRs. Enterprise builds replace this with WireSetBase plus
// their own ReconcileGVRs provider.
var WireSet = wire.NewSet(
	WireSetBase,
	ProvideReconcileGVRs,
)
