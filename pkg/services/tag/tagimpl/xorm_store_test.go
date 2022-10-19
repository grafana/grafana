package tagimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
)

func TestIntegrationXormSavingTags(t *testing.T) {
	testIntegrationSavingTags(t, func(ss db.DB) store {
		return &sqlStore{db: ss}
	})
}
