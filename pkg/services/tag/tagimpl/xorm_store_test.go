package tagimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
)

func TestIntegrationXormSavingTags(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	testIntegrationSavingTags(t, func(ss db.DB) store {
		return &sqlStore{db: ss}
	})
}
