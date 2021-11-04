//go:build wireinject
// +build wireinject

package runner

import (
	"github.com/google/wire"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/services/secrets"
	secretsDatabase "github.com/grafana/grafana/pkg/services/secrets/database"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

var wireSet = wire.NewSet(
	New,
	routing.ProvideRegister,
	wire.Bind(new(routing.RouteRegister), new(*routing.RouteRegisterImpl)),
	secretsManager.ProvideSecretsService,
	wire.Bind(new(secrets.Service), new(*secretsManager.SecretsService)),
	secretsDatabase.ProvideSecretsStore,
	wire.Bind(new(secrets.Store), new(*secretsDatabase.SecretsStoreImpl)),
)

func Initialize(cfg *setting.Cfg, sqlStore *sqlstore.SQLStore) (Runner, error) {
	wire.Build(wireExtsSet)
	return Runner{}, nil
}
