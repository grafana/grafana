package repo

import (
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
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

func TestErrorTemplates(t *testing.T) {
	base := &errutil.Error{}

	err := ErrVersionUnsupported("grafana-test-app", "1.0.0", "darwin-amd64")
	require.True(t, errors.As(err, base))
	require.Equal(t, http.StatusConflict, base.Public().StatusCode)
	require.Equal(t, "plugin.unsupportedVersion", base.Public().MessageID)
	require.Equal(t, "grafana-test-app v1.0.0 is not supported on your system darwin-amd64", base.Public().Message)

	err = ErrVersionNotFound("grafana-test-app", "1.0.0", "darwin-amd64")
	require.True(t, errors.As(err, base))
	require.Equal(t, http.StatusNotFound, base.Public().StatusCode)
	require.Equal(t, "plugin.versionNotFound", base.Public().MessageID)
	require.Equal(t, "grafana-test-app v1.0.0 either does not exist or is not supported on your system darwin-amd64", base.Public().Message)

	err = ErrArcNotFound("grafana-test-app", "darwin-amd64")
	require.True(t, errors.As(err, base))
	require.Equal(t, http.StatusNotFound, base.Public().StatusCode)
	require.Equal(t, "plugin.archNotFound", base.Public().MessageID)
	require.Equal(t, "grafana-test-app is not compatible with your system architecture: darwin-amd64", base.Public().Message)

	expectedChecksum := "abcdef1234567890"
	computedChecksum := "abcdef0987654321"
	err = ErrChecksumMismatch("http://localhost:6481/grafana-test-app/versions/1.0.0/download", expectedChecksum, computedChecksum)
	require.True(t, errors.As(err, base))
	require.Equal(t, http.StatusUnprocessableEntity, base.Public().StatusCode)
	require.Equal(t, "plugin.checksumMismatch", base.Public().MessageID)
	require.Equal(t, "expected SHA256 checksum (abcdef1234567890) does not match the downloaded archive (http://localhost:6481/grafana-test-app/versions/1.0.0/download) computed SHA256 checksum (abcdef0987654321) - please contact security@grafana.com", base.Public().Message)

	err = ErrCorePlugin("grafana-test-app")
	require.True(t, errors.As(err, base))
	require.Equal(t, http.StatusForbidden, base.Public().StatusCode)
	require.Equal(t, "plugin.forbiddenCorePluginInstall", base.Public().MessageID)
	require.Equal(t, "plugin grafana-test-app is a core plugin and cannot be installed separately", base.Public().Message)
}
