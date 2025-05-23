package testsuite

import (
	"os"
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
)

func Run(m *testing.M) {
	db.SetupTestDB()
	code := m.Run()
	db.CleanupTestDB()
	os.Exit(code)
}
