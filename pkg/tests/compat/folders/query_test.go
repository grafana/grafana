package folders

import (
	"net/url"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

// A continue token is opaque, so the query must carry any token intact, also one with
// characters a query string treats specially.
func TestChildrenQueryKeepsTheContinueToken(t *testing.T) {
	for _, token := range []string{"", "2", "a+b/c=d e&f"} {
		_, query, ok := strings.Cut(childrenQuery(5, token), "?")
		require.True(t, ok)
		values, err := url.ParseQuery(query)
		require.NoError(t, err)
		require.Equal(t, "5", values.Get("limit"))
		require.Equal(t, token, values.Get("continue"), "token %q", token)
	}
}
