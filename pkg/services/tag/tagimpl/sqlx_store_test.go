package tagimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func TestIntegrationSQLxSavingTags(t *testing.T) {
	testIntegrationSavingTags(t, func(ss *sqlstore.SQLStore) store {
		return &sqlxStore{sess: ss.GetSqlxSession()}
	})
}
