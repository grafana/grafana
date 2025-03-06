package testsuite

import (
	"os"
	"testing"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func Run(m *testing.M) {
	//nolint:staticcheck // SA1019 The function is used by testsuite only.
	sqlstore.SetupTestDB()
	code := m.Run()
	//nolint:staticcheck // SA1019 The function is used by testsuite only.
	sqlstore.CleanupTestDB()
	os.Exit(code)
}
