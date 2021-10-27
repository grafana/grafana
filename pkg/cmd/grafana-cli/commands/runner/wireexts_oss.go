//go:build wireinject && oss
// +build wireinject,oss

package runner

import (
	"github.com/google/wire"
	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/services/encryption/ossencryption"
	"github.com/grafana/grafana/pkg/setting"
)

var wireExtsSet = wire.NewSet(
	wireSet,
	setting.ProvideProvider,
	wire.Bind(new(setting.Provider), new(*setting.OSSImpl)),
	ossencryption.ProvideService,
	wire.Bind(new(encryption.Service), new(*ossencryption.Service)),
)
