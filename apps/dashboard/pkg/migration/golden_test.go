package migration

import (
	"fmt"
	"os"
	"testing"

	migrationtestutil "github.com/grafana/grafana/apps/dashboard/pkg/migration/testutil"
)

var goldenChecksums = migrationtestutil.NewChecksumStore("testdata/golden_checksums.json")

func TestMain(m *testing.M) {
	goldenChecksums.Load()

	code := m.Run()

	if migrationtestutil.ShouldRegenerateChecksums() {
		if err := goldenChecksums.Save(); err != nil {
			fmt.Fprintf(os.Stderr, "ERROR saving golden checksums: %v\n", err)
			os.Exit(1)
		}
	}

	os.Exit(code)
}
