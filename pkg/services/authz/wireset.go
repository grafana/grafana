package authz

import (
	"github.com/google/wire"

	"github.com/grafana/grafana/pkg/services/authz/zanzana"
)

// WireSetBase contains the authz providers that are stable across OSS and
// enterprise builds. Enterprise wirings should include WireSetBase (not
// WireSet) so they can rebind overridable providers such as the reconciler
// CRD list.
var WireSetBase = wire.NewSet(
	zanzana.ProvidePermissionCheckerProxy,
	ProvideAuthZClient,
	ProvideZanzanaClient,
	ProvideEmbeddedZanzanaServer,
	ProvideEmbeddedZanzanaService,
)
