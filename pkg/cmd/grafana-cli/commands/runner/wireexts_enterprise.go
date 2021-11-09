//go:build wireinject && (enterprise || pro)
// +build wireinject
// +build enterprise pro

package runner

import (
	"github.com/google/wire"
	entencryption "github.com/grafana/grafana/pkg/extensions/encryption"
	enterprisemigrations "github.com/grafana/grafana/pkg/extensions/migrations"
	"github.com/grafana/grafana/pkg/extensions/settings/settingsprovider"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/ossaccesscontrol"
	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations"
	"github.com/grafana/grafana/pkg/setting"
)

var wireExtsSet = wire.NewSet(
	wireSet,
	migrations.ProvideOSSMigrations,
	enterprisemigrations.ProvideEnterpriseMigrations,
	wire.Bind(new(registry.DatabaseMigrator), new(*enterprisemigrations.EnterpriseMigrations)),
	ossaccesscontrol.ProvideService,
	wire.Bind(new(accesscontrol.AccessControl), new(*ossaccesscontrol.OSSAccessControlService)),
	settingsprovider.ProvideService,
	wire.Bind(new(setting.Provider), new(*settingsprovider.Implementation)),
	entencryption.ProvideEncryption,
	wire.Bind(new(encryption.Service), new(*entencryption.Encryption)),
)
