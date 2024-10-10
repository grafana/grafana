package authz

import (
	"github.com/google/wire"
	"github.com/grafana/grafana/pkg/services/authz/legacy/client"
)

var WireSet = wire.NewSet(
	ProvideAuthZClient,
	ProvideZanzana,
	ProvideLegacy,
	wire.Bind(new(ReadClient), new(*client.Client)),
)
