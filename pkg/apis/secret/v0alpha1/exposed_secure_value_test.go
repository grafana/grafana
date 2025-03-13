package v0alpha1_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"
)

func TestExposedSecureValue(t *testing.T) {
	expected := "[REDACTED]"

	rawValue := "a-password"
	esv := v0alpha1.NewExposedSecureValue(rawValue)

	// String must not return the exposed secure value.
	require.Equal(t, expected, esv.String())

	// Format/GoString must not return the exposed secure value.
	require.Equal(t, expected, fmt.Sprintf("%+#v", esv))
	require.Equal(t, expected, fmt.Sprintf("%v", esv))
	require.Equal(t, expected, fmt.Sprintf("%s", esv))

	buf := new(bytes.Buffer)
	_, err := fmt.Fprintf(buf, "%#v", esv)
	require.NoError(t, err)
	require.Equal(t, expected, buf.String())

	// MarshalJSON must not return the exposed secure value.
	bytes, err := json.Marshal(esv)
	require.NoError(t, err)
	require.Equal(t, `"`+expected+`"`, string(bytes))

	// MarshalYAML must not return the exposed secure value.
	bytes, err = yaml.Marshal(esv)
	require.NoError(t, err)
	require.Equal(t, "'"+expected+"'\n", string(bytes))

	// DangerouslyExposeAndConsumeValue returns the raw value.
	require.Equal(t, rawValue, esv.DangerouslyExposeAndConsumeValue())

	// Further calls to DangerouslyExposeAndConsumeValue will panic.
	require.Panics(t, func() { esv.DangerouslyExposeAndConsumeValue() })
}
