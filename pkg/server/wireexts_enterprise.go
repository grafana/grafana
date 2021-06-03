// +build wireinject,enterprise

package server

import (
	"github.com/google/wire"
	"github.com/grafana/grafana/pkg/extensions/licensing"
	"github.com/grafana/grafana/pkg/models"
)

var wireExtsBasicSet = wire.NewSet(
	licensing.ProvideLicensing,
	licensing.ProvideLicenseTokenService,
	wire.Bind(new(models.Licensing), new(*licensing.LicenseTokenService)),
)

var wireExtsSet = wire.NewSet(
	wireSet,
	wireExtsBasicSet,
)

var wireExtsTestSet = wire.NewSet(
	wireTestSet,
	wireExtsBasicSet,
)
