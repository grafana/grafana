//go:build wireinject && oss
// +build wireinject,oss

package runner

import (
	"github.com/google/wire"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/encryption"
	encryptionprovider "github.com/grafana/grafana/pkg/services/encryption/provider"
	"github.com/grafana/grafana/pkg/services/kmsproviders"
	"github.com/grafana/grafana/pkg/services/kmsproviders/osskmsproviders"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations"
	"github.com/grafana/grafana/pkg/setting"
)

var wireExtsSet = wire.NewSet(
	wireSet,
	migrations.ProvideOSSMigrations,
	licensing.ProvideService,
	wire.Bind(new(models.Licensing), new(*licensing.OSSLicensingService)),
	wire.Bind(new(registry.DatabaseMigrator), new(*migrations.OSSMigrations)),
	setting.ProvideProvider,
	wire.Bind(new(setting.Provider), new(*setting.OSSImpl)),
	osskmsproviders.ProvideService,
	wire.Bind(new(kmsproviders.Service), new(osskmsproviders.Service)),
	encryptionprovider.ProvideEncryptionProvider,
	wire.Bind(new(encryption.Provider), new(encryptionprovider.Provider)),
)
