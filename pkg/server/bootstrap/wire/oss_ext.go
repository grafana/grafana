//go:build wireinject && oss
// +build wireinject,oss

package wire

import (
	"github.com/google/wire"

	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/extras"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/apiserver/standalone"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/hooks"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
)

var provisioningExtras = wire.NewSet(
	extras.ProvideProvisioningOSSRepositoryExtras,
	extras.ProvideProvisioningOSSConnectionExtras,
	extras.ProvideFactoryFromConfig,
)

var configProviderExtras = wire.NewSet(
	configprovider.ProvideService,
)

// BaseCLISet is a simplified set of dependencies for the OSS CLI, suitable for
// running background services and targeted dskit modules without starting the
// full Grafana server.
var BaseCLISet = wire.NewSet(
	server.NewModuleRunner,
	metrics.WireSet,
	featuremgmt.ProvideManagerService,
	featuremgmt.ProvideToggles,
	hooks.ProvideService,
	setting.ProvideProvider, wire.Bind(new(setting.Provider), new(*setting.OSSImpl)),
	licensing.ProvideService, wire.Bind(new(licensing.Licensing), new(*licensing.OSSLicensingService)),
	configProviderExtras,
)

var StandaloneAPIServerSet = wire.NewSet(
	standalone.ProvideAPIServerFactory,
)
