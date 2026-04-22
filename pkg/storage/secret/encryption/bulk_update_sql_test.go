package encryption

import (
	"fmt"
	"strings"
	"testing"

	sq "github.com/Masterminds/squirrel"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
)

// TestBuildBulkUpdateSQL locks the shape of the hand-authored bulk UPDATE
// against regression. buildBulkUpdateSQL is one of three queries that escape
// squirrel's builder (the other two live in metadata): verifying the exact
// SQL string and argument sequence under both placeholder formats is the
// cheapest regression protection we have.
func TestBuildBulkUpdateSQL(t *testing.T) {
	rows := []contracts.BulkUpdateRow{
		{Name: "a", Version: 1, Payload: contracts.EncryptedPayload{EncryptedData: []byte("da"), DataKeyID: "k1"}},
		{Name: "b", Version: 2, Payload: contracts.EncryptedPayload{EncryptedData: []byte("db"), DataKeyID: "k2"}},
	}

	wantArgs := []any{
		// encrypted_data CASE block.
		"ns", "a", int64(1), []byte("da"),
		"ns", "b", int64(2), []byte("db"),
		// data_key_id CASE block.
		"ns", "a", int64(1), "k1",
		"ns", "b", int64(2), "k2",
		// standalone updated.
		int64(555),
		// WHERE namespace + expanded OR branches.
		"ns",
		"a", int64(1),
		"b", int64(2),
	}

	t.Run("question", func(t *testing.T) {
		sql, args, err := buildBulkUpdateSQL(sq.Question, "ns", rows, 555)
		require.NoError(t, err)
		require.Equal(t, wantArgs, args)
		// Confirm it's ? placeholders and the count matches the args.
		require.Equal(t, len(wantArgs), strings.Count(sql, "?"))
	})

	t.Run("dollar", func(t *testing.T) {
		sql, args, err := buildBulkUpdateSQL(sq.Dollar, "ns", rows, 555)
		require.NoError(t, err)
		require.Equal(t, wantArgs, args)
		// ? is rebound to $N. Expect no bare ? and the highest placeholder to
		// equal the arg count.
		require.Equal(t, 0, strings.Count(sql, "?"))
		require.Contains(t, sql, "$1")
		require.Contains(t, sql, fmt.Sprintf("$%d", len(wantArgs)))
		// Postgres requires an explicit bytea cast on the CASE branch that
		// targets the bytea column — without it, the driver infers text and
		// Postgres rejects the UPDATE.
		require.Contains(t, sql, "::bytea")
	})
}
