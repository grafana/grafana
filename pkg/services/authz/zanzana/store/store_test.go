package store

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSqliteConnectionString(t *testing.T) {
	testCases := []struct {
		desc string
		in   string
		out  string
	}{
		{
			desc: "production database shares the hardcoded zanzana.db",
			in:   "file:/var/lib/grafana/grafana.db?cache=private",
			out:  "file:/var/lib/grafana/zanzana.db",
		},
		{
			desc: "legacy shared test database gets a per-database sibling",
			in:   "file:/home/u/.cache/grafana-test/grafana-test-123.db",
			out:  "file:/home/u/.cache/grafana-test/zanzana-test-123.db",
		},
		{
			desc: "NewTestStore database gets a per-database sibling",
			in:   "file:/tmp/grafana-test-sqlite-abc.db?cache=private&mode=rwc",
			out:  "file:/tmp/zanzana-test-sqlite-abc.db?cache=private&mode=rwc",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			assert.Equal(t, tc.out, sqliteConnectionString(tc.in))
		})
	}
}
