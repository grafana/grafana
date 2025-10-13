package nameutil

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSanitizeSAName(t *testing.T) {
	// max possible length without hashing
	len180, err := generateRandomString(180)
	require.NoError(t, err)
	require.Equal(t, len180, SanitizeSAName(len180))

	// too long length - postfix hashed
	len200, err := generateRandomString(200)
	require.NoError(t, err)
	len200sanitized := SanitizeSAName(len200)
	require.Equal(t, fmt.Sprintf("%s%s", len200[:148], len200sanitized[148:]), len200sanitized)
}

func generateRandomString(length int) (string, error) {
	buffer := make([]byte, length)
	_, err := rand.Read(buffer)
	if err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(buffer)[:length], nil
}
