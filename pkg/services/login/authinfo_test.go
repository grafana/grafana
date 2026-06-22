package login

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGetAuthProviderLabel(t *testing.T) {
	require.Equal(t, "Passkey", GetAuthProviderLabel(PasskeyAuthModule))
	require.Equal(t, "Unknown", GetAuthProviderLabel("something-unmapped"))
}
