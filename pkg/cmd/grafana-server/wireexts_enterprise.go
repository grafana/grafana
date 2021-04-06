// +build wireinject,enterprise

package main

import (
	"github.com/google/wire"
	"github.com/grafana/grafana/pkg/extensions/licensing"
	"github.com/grafana/grafana/pkg/models"
)

var wireExtsSet = wire.NewSet(
	wireSet,
	licensing.ProvideLicensing,
	licensing.ProvideLicenseTokenService,
	wire.Bind(new(models.Licensing), new(*licensing.LicenseTokenService)),
)
