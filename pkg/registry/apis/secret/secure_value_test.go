package secret_test

import (
	"encoding/json"
	"testing"

	"github.com/grafana/grafana/pkg/registry/apis/secret"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"
)

func TestExposedSecureValue(t *testing.T) {
	rawValue := "a-password"
	esv := secret.NewExposedSecureValue(rawValue)

	// String must not return the exposed secure value.
	require.Equal(t, "[REDACTED]", esv.String())

	// MarshalJSON must not return the exposed secure value.
	bytes, err := json.Marshal(esv)
	require.NoError(t, err)
	require.Equal(t, `"[REDACTED]"`, string(bytes))

	// MarshalYAML must not return the exposed secure value.
	bytes, err = yaml.Marshal(esv)
	require.NoError(t, err)
	require.Equal(t, "'[REDACTED]'\n", string(bytes))

	// DangerouslyExposeDecryptedValue returns the raw value.
	require.Equal(t, rawValue, esv.DangerouslyExposeDecryptedValue())
}
