//go:build wireinject && oss
// +build wireinject,oss

package wire

import (
	"github.com/google/wire"

	"github.com/grafana/grafana/pkg/services/apiserver/standalone"
)

var StandaloneAPIServerSet = wire.NewSet(
	standalone.ProvideAPIServerFactory,
)
