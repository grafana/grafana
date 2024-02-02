package provisioning

import (
	"os"
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
)

func TestMain(m *testing.M) {
	code := m.Run()
	db.CleanupTestDB()
	os.Exit(code)
}
