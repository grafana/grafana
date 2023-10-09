package authorizer

import (
	"github.com/google/wire"

	"github.com/grafana/grafana/pkg/services/grafana-apiserver/auth/authorizer/org"
)

var WireSet = wire.NewSet(
	org.WireSet,
	ProvideAuthorizer,
)
