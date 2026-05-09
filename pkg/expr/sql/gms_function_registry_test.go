//go:build !arm

package sql

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIsKnownEngineFunction(t *testing.T) {
	t.Run("GMS BuiltIns are recognised", func(t *testing.T) {
		// A sample of GMS built-ins that are intentionally absent from our allowlist.
		knownEngineButDisallowed := []string{
			"sleep", "load_file", "md5", "sha1", "lpad", "rpad",
			"user", "database", "connection_id", "found_rows",
			"compress", "uuid", "hex", "unhex",
		}
		for _, fn := range knownEngineButDisallowed {
			require.Truef(t, IsKnownEngineFunction(fn), "expected %q to be a known GMS function", fn)
			// Check must be case-insensitive.
			require.Truef(t, IsKnownEngineFunction(strings.ToUpper(fn)), "expected upper-case %q to be a known GMS function", fn)
		}
	})

	t.Run("functions registered outside BuiltIns are recognised", func(t *testing.T) {
		// These come from GetLockingFuncs / separate engine registration,
		// not from function.BuiltIns, so they are covered by gmsExtraFunctions.
		extra := []string{"get_lock", "is_free_lock", "is_used_lock", "release_lock", "release_all_locks", "version"}
		for _, fn := range extra {
			require.Truef(t, IsKnownEngineFunction(fn), "expected %q (extra GMS function) to be recognised", fn)
		}
	})

	t.Run("arbitrary user-supplied names are not recognised", func(t *testing.T) {
		for _, fn := range []string{"my_custom_udf", "nonexistent_fn"} {
			require.Falsef(t, IsKnownEngineFunction(fn), "expected %q to NOT be a known GMS function", fn)
		}
	})

	t.Run("allowlisted parser-special forms absent from the GMS registry return false", func(t *testing.T) {
		// trim and timestampadd are allowed via special AST node types (TrimExpr,
		// TimestampFuncExpr) and are not in the GMS function registry. They are
		// never disallowed so this false result has no practical effect on metrics,
		// but it is documented here so the gap is explicit.
		for _, fn := range []string{"trim", "timestampadd"} {
			require.Falsef(t, IsKnownEngineFunction(fn), "%q is allowlisted via a special AST node type and is absent from the GMS registry", fn)
		}
	})
}
