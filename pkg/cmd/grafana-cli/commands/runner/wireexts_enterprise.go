// +build wireinject
// +build enterprise pro

package runner

import (
	"github.com/google/wire"
	entencryption "github.com/grafana/grafana/pkg/extensions/encryption"
	"github.com/grafana/grafana/pkg/extensions/settings/settingsprovider"
	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/setting"
)

var wireExtsSet = wire.NewSet(
	wireSet,
	settingsprovider.ProvideService, /// <<------- REVIEW
	wire.Bind(new(setting.Provider), new(*settingsprovider.Implementation)),
	entencryption.ProvideEncryption,
	wire.Bind(new(encryption.Service), new(*entencryption.Encryption)),
	/// <<------- SecretsProviderServer
)
