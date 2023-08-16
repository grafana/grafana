package repo

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestErrResponse4xx(t *testing.T) {
	t.Run("newErrResponse4xx returns expected error string", func(t *testing.T) {
		err := newErrResponse4xx(http.StatusBadRequest)
		require.Equal(t, "400", err.Error())
		require.Equal(t, http.StatusBadRequest, err.StatusCode())

		msg := "This is terrible news"
		err = err.withMessage(msg)
		require.Equal(t, "400: This is terrible news", err.Error())
		require.Equal(t, msg, err.Message())

		compatInfo := NewCompatOpts("10.0.0", "darwin", "amd64")
		err = err.withCompatibilityInfo(compatInfo)
		require.Equal(t, "400: This is terrible news (Grafana v10.0.0 darwin-amd64)", err.Error())
		require.Equal(t, compatInfo, err.compatibilityInfo)
	})
}
