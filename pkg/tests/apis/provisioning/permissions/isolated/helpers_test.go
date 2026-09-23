package isolated

import (
	"os"
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
)

// Initialize database support without starting a shared server; each test chooses
// its own controller, feature, or resource configuration.
func TestMain(m *testing.M) {
	db.SetupTestDB()
	code := m.Run()
	db.CleanupTestDB()
	os.Exit(code)
}
