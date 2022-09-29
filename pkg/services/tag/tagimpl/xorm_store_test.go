package tagimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func TestIntegrationXormSavingTags(t *testing.T) {
	testIntegrationSavingTags(t, func(ss *sqlstore.SQLStore) store {
		return &sqlStore{db: ss}
	})
}
