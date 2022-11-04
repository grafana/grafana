package apikeyimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/setting"
)

func TestIntegrationSQLxApiKeyDataAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	testIntegrationApiKeyDataAccess(t, func(ss db.DB, cfg *setting.Cfg) store {
		return &sqlxStore{sess: ss.GetSqlxSession(), cfg: cfg}
	})
}
