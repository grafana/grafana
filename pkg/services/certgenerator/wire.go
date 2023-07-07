package certgenerator

import (
	"github.com/google/wire"
	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana-apiserver/pkg/certgenerator"
)

var WireSet = wire.NewSet(
	ProvideService,
	wire.Bind(new(services.NamedService), new(*certgenerator.Service)),
)
