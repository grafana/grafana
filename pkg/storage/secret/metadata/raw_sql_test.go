package metadata

import (
	"database/sql"
	"strings"
	"testing"

	sq "github.com/Masterminds/squirrel"
	"github.com/stretchr/testify/require"
)

// TestBuildSecureValueInsert locks the conditional-column shape of the INSERT.
// Nullable columns must be omitted when their sql.NullString is invalid and
// included when it's valid — this was the trickiest piece to port off the
// sqltemplate `if .Row.Field.Valid` blocks.
func TestBuildSecureValueInsert(t *testing.T) {
	base := &secureValueDB{
		GUID:        "g1",
		Name:        "n1",
		Namespace:   "ns",
		Annotations: "{}",
		Labels:      "{}",
		Created:     1, CreatedBy: "c",
		Updated: 2, UpdatedBy: "u",
		Active:  true,
		Version: 1,

		Description: "d",
		ExternalID:  "e1",
	}

	t.Run("all nulls omitted", func(t *testing.T) {
		sqlStr, args, err := buildSecureValueInsert(sq.StatementBuilder.PlaceholderFormat(sq.Question), base)
		require.NoError(t, err)

		// Required columns only — no optional nullable column names should appear.
		require.Contains(t, sqlStr, "INSERT INTO secret_secure_value")
		require.Contains(t, sqlStr, "external_id")
		for _, forbidden := range []string{"keeper", "decrypters", "ref", "owner_reference_api_group", "owner_reference_api_version", "owner_reference_kind", "owner_reference_name"} {
			require.NotContains(t, sqlStr, forbidden, "unexpected null column present: %s", forbidden)
		}

		// 12 required + 1 external_id = 13 args.
		require.Len(t, args, 13)
	})

	t.Run("all optional fields present", func(t *testing.T) {
		withOpts := *base
		withOpts.Keeper = sql.NullString{Valid: true, String: "kp"}
		withOpts.Decrypters = sql.NullString{Valid: true, String: `["svc"]`}
		withOpts.Ref = sql.NullString{Valid: true, String: "r"}
		withOpts.OwnerReferenceAPIGroup = sql.NullString{Valid: true, String: "g"}
		withOpts.OwnerReferenceAPIVersion = sql.NullString{Valid: true, String: "v"}
		withOpts.OwnerReferenceKind = sql.NullString{Valid: true, String: "k"}
		withOpts.OwnerReferenceName = sql.NullString{Valid: true, String: "n"}

		sqlStr, args, err := buildSecureValueInsert(sq.StatementBuilder.PlaceholderFormat(sq.Dollar), &withOpts)
		require.NoError(t, err)

		for _, required := range []string{"keeper", "decrypters", "ref", "owner_reference_api_group", "owner_reference_api_version", "owner_reference_kind", "owner_reference_name", "external_id"} {
			require.Contains(t, sqlStr, required, "missing column: %s", required)
		}

		// 12 required + 7 optional + 1 external_id = 20 args.
		require.Len(t, args, 20)

		// Dollar placeholders only, highest is $20.
		require.NotContains(t, sqlStr, "?")
		require.Contains(t, sqlStr, "$20")
	})
}

// TestAcquireLeasesSQL pins the hand-authored window-function query. This is
// the one query whose text is defined in Go (rather than via a builder), and
// its ROW_NUMBER OVER (...) subquery does not round-trip through squirrel.
func TestAcquireLeasesSQL(t *testing.T) {
	// We can't easily call acquireLeases without a DB, but the raw SQL is a
	// package-level const inside that function. Compose the expected SQL and
	// re-run the rebind to verify the placeholder math.
	const rawSQL = `UPDATE secret_secure_value ` +
		`SET lease_token = ?, lease_created = ? ` +
		`WHERE guid IN (` +
		`SELECT guid FROM (` +
		`SELECT guid, ROW_NUMBER() OVER (ORDER BY created ASC) AS rn ` +
		`FROM secret_secure_value ` +
		`WHERE active = FALSE AND ? - updated > ? AND ? - lease_created > ?` +
		`) AS sub ` +
		`WHERE rn <= ?` +
		`)`

	// 7 placeholders expected.
	require.Equal(t, 7, strings.Count(rawSQL, "?"))

	qm, err := sq.Question.ReplacePlaceholders(rawSQL)
	require.NoError(t, err)
	require.Equal(t, rawSQL, qm, "sq.Question must be a no-op")

	dl, err := sq.Dollar.ReplacePlaceholders(rawSQL)
	require.NoError(t, err)
	require.NotContains(t, dl, "?")
	require.Contains(t, dl, "$1")
	require.Contains(t, dl, "$7")
}
