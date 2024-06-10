package queryhistory

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestQueryHistoryDatasourceIndex(t *testing.T) {
	t.Run("should find data source uids", func(t *testing.T) {
		uids, err := FindDataSourceUIDs("")
		require.NoError(t, err)
		require.Len(t, uids, 0)
	})
}
