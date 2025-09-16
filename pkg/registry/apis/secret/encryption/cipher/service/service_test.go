package service

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"

	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher"
)

func newGcmService(t *testing.T) cipher.Cipher {
	t.Helper()

	usageStats := &usagestats.UsageStatsMock{}
	svc, err := ProvideAESGCMCipherService(noop.NewTracerProvider().Tracer("test"), usageStats)
	require.NoError(t, err, "failed to set up encryption service")
	return svc
}

func TestService(t *testing.T) {
	t.Parallel()

	t.Run("decrypt empty payload should return error", func(t *testing.T) {
		t.Parallel()

		svc := newGcmService(t)
		_, err := svc.Decrypt(t.Context(), []byte(""), "1234")
		require.Error(t, err)

		assert.Equal(t, "unable to derive encryption algorithm", err.Error())
	})

	t.Run("encrypt and decrypt with GCM should work", func(t *testing.T) {
		t.Parallel()

		svc := newGcmService(t)
		encrypted, err := svc.Encrypt(t.Context(), []byte("grafana"), "1234")
		require.NoError(t, err)

		decrypted, err := svc.Decrypt(t.Context(), encrypted, "1234")
		require.NoError(t, err)

		assert.Equal(t, []byte("grafana"), decrypted)
		// We'll let the provider deal with testing details.
	})
}
