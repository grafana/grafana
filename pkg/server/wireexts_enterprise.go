// +build wireinject,enterprise

package server

import (
	"github.com/google/wire"
	"github.com/grafana/grafana/pkg/extensions/accesscontrol/database"
	"github.com/grafana/grafana/pkg/extensions/accesscontrol/manager"
	"github.com/grafana/grafana/pkg/extensions/accesscontrol/provisioner"
	"github.com/grafana/grafana/pkg/extensions/analytics"
	"github.com/grafana/grafana/pkg/extensions/backgroundsvcs"
	"github.com/grafana/grafana/pkg/extensions/licensing"
	"github.com/grafana/grafana/pkg/extensions/provisioning/service"
	"github.com/grafana/grafana/pkg/extensions/requestinterceptor"
	"github.com/grafana/grafana/pkg/extensions/settings/settingsprovider"
	ossbackgroundsvcs "github.com/grafana/grafana/pkg/infra/backgroundsvcs"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/provisioning"
	"github.com/grafana/grafana/pkg/setting"
)

var wireExtsBasicSet = wire.NewSet(
	licensing.ProvideLicensing,
	licensing.ProvideLicenseTokenService,
	wire.Bind(new(models.Licensing), new(*licensing.LicenseTokenService)),
	requestinterceptor.ProvideService,
	wire.Bind(new(models.PluginRequestValidator), new(*requestinterceptor.RequestInterceptor)),
	settingsprovider.ProvideService,
	wire.Bind(new(setting.Provider), new(*settingsprovider.Implementation)),
	manager.ProvideService,
	wire.Bind(new(accesscontrol.AccessControl), new(*manager.CacheWrapper)),
	database.ProvideService,
	wire.Bind(new(provisioner.Store), new(*database.AccessControlStore)),
	service.ProvideService,
	wire.Bind(new(provisioning.ProvisioningService), new(*service.EnterpriseProvisioningServiceImpl)),
	provisioner.ProvideService,
	analytics.ProvideService,
	backgroundsvcs.ProvideService,
	wire.Bind(new(ossbackgroundsvcs.Service), new(*backgroundsvcs.Container)),
)

var wireExtsSet = wire.NewSet(
	wireSet,
	wireExtsBasicSet,
)

var wireExtsTestSet = wire.NewSet(
	wireTestSet,
	wireExtsBasicSet,
)
