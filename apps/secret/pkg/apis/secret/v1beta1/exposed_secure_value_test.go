//
// THIS FILE IS MANUALLY GENERATED TO OVERCOME LIMITATIONS WITH CUE. FEEL FREE TO EDIT IT.
//

package v1beta1

import (
	"bytes"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestExposedSecureValue(t *testing.T) {
	expected := "[REDACTED]"

	rawValue := "a-password"
	esv := NewExposedSecureValue(rawValue)

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

	// DangerouslyExposeAndConsumeValue returns the raw value.
	require.Equal(t, rawValue, esv.DangerouslyExposeAndConsumeValue())

	// Further calls to DangerouslyExposeAndConsumeValue will panic.
	require.Panics(t, func() { esv.DangerouslyExposeAndConsumeValue() })
}
