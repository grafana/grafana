package testsuite

import (
	"os"
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
)

func Run(m *testing.M) {
	os.Exit(RunWithDB(m))
}

// RunWithDB runs the tests and returns their exit code after tearing down the test DB.
func RunWithDB(m *testing.M) int {
	db.SetupTestDB()
	code := m.Run()
	db.CleanupTestDB()
	return code
}
