package service

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher/provider"
)

func newGcmService(t *testing.T) cipher.Cipher {
	t.Helper()

	usageStats := &usagestats.UsageStatsMock{}
	svc, err := ProvideAESGCMCipherService(noop.NewTracerProvider().Tracer("test"), usageStats)
	require.NoError(t, err, "failed to set up encryption service")
	return svc
}

type erroringEncrypter struct{ err error }

func (e erroringEncrypter) Encrypt(context.Context, []byte, string) ([]byte, error) {
	return nil, e.err
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

	t.Run("decrypt payload missing algorithm delimiter should return error not panic", func(t *testing.T) {
		t.Parallel()

		svc := newGcmService(t)

		// A payload with a leading delimiter byte but no closing delimiter.
		// Previously this caused a panic via slice bounds out of range
		// because bytes.Index returned -1 and it was used as a slice bound.
		malformed := []byte("*no-closing-delimiter")
		_, err := svc.Decrypt(t.Context(), malformed, "1234")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "missing algorithm delimiter")
	})

	t.Run("decrypt single-byte payload should return error not panic", func(t *testing.T) {
		t.Parallel()

		svc := newGcmService(t)
		_, err := svc.Decrypt(t.Context(), []byte("x"), "1234")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "missing algorithm delimiter")
	})

	t.Run("encrypt should propagate cipher error instead of returning a bogus ciphertext", func(t *testing.T) {
		t.Parallel()

		// Regression: Encrypt used to discard this error and return a bogus payload as success.
		wantErr := errors.New("cipher failure")
		svc := &cipherService{
			tracer:    noop.NewTracerProvider().Tracer("test"),
			log:       log.New("test"),
			cipher:    erroringEncrypter{err: wantErr},
			algorithm: provider.AesGcm,
		}

		out, err := svc.Encrypt(t.Context(), []byte("grafana"), "1234")
		require.ErrorIs(t, err, wantErr)
		require.Nil(t, out)
	})
}
