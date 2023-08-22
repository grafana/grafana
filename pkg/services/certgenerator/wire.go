package certgenerator

import (
	"github.com/google/wire"
	"github.com/grafana/grafana-apiserver/pkg/certgenerator"
)

var WireSet = wire.NewSet(
	ProvideService,
	wire.Bind(new(certgenerator.ServiceInterface), new(*certgenerator.Service)),
)
