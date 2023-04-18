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
		require.Equal(t, http.StatusBadRequest, err.StatusCode)

		msg := "This is terrible news"
		err = err.WithMessage(msg)
		require.Equal(t, "400: This is terrible news", err.Error())
		require.Equal(t, msg, err.Message)

		sysInfo := "darwin-amd64 grafana v10.0.0"
		err = err.WithSystemInfo(sysInfo)
		require.Equal(t, "400: This is terrible news (darwin-amd64 grafana v10.0.0)", err.Error())
		require.Equal(t, sysInfo, err.systemInfo)
	})
}
