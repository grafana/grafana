package migrator

import (
	"strings"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIndexXNameConcurrent(t *testing.T) {
	t.Parallel()
	for _, tc := range []struct {
		name string
		kind int
		want string
	}{
		{kind: IndexType, want: "IDX_table_col_one_col_two"},
		{kind: UniqueIndex, want: "UQE_table_col_one_col_two"},
		{name: "custom", kind: IndexType, want: "IDX_table_custom"},
		{name: "UQE_existing", kind: UniqueIndex, want: "UQE_existing"},
		{name: "IDX_existing", kind: IndexType, want: "IDX_existing"},
	} {
		t.Run(tc.want, func(t *testing.T) {
			t.Parallel()
			index := &Index{Name: tc.name, Type: tc.kind, Cols: []string{"col_one", "col_two"}}
			drop := NewDropIndexMigration(Table{Name: "table"}, index)
			var wg sync.WaitGroup
			for range 8 {
				wg.Go(func() {
					for range 100 {
						if got := index.XName("table"); got != tc.want {
							t.Errorf("index name = %q, want %q", got, tc.want)
						}
						if sql := drop.SQL(NewDialect("sqlite3")); !strings.Contains(sql, tc.want) {
							t.Errorf("drop SQL %q must use index %q", sql, tc.want)
						}
					}
				})
			}
			wg.Wait()
			require.Equal(t, tc.name, index.Name, "migration definitions must remain reusable across databases")
		})
	}
}
