package kvstoretest

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/secrets/kvstore"
	secretsmng "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/secrets/manager/managertest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func NewFakeSQLSecretsKVStore(t *testing.T, sqlStore *sqlstore.SQLStore) *kvstore.SecretsKVStoreSQL {
	t.Helper()
	secretsService := managertest.SetupService(secretsmng.ProvideSecretsService, t, fakes.NewFakeSecretsStore())
	return kvstore.NewSQLSecretsKVStore(sqlStore, secretsService, log.New("test.logger"))
}
