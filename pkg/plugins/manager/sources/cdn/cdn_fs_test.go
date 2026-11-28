package cdn

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestFS_Rel(t *testing.T) {
	fs := NewFS("https://cdn.example.com/plugins/parent", http.DefaultClient)

	t.Run("The path is relative to the base and uses forward slashes", func(t *testing.T) {
		got, err := fs.Rel("https://cdn.example.com/plugins/parent/panels/child")
		require.NoError(t, err)
		require.Equal(t, "panels/child", got)
	})

	t.Run("A different host is an error", func(t *testing.T) {
		_, err := fs.Rel("https://other.example.com/plugins/parent/panels/child")
		require.Error(t, err)
	})
}
