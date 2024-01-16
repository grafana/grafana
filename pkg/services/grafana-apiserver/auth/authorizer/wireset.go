package authorizer

import (
	"github.com/google/wire"

	"github.com/grafana/grafana/pkg/services/grafana-apiserver/auth/authorizer/org"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/auth/authorizer/stack"
)

var WireSet = wire.NewSet(
	org.WireSet,
	stack.WireSet,
	ProvideAuthorizer,
)
