package github_test

import (
	"encoding/base64"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/apps/provisioning/pkg/connection/github"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

func TestGenerateJWTToken(t *testing.T) {
	privateKeyBase64 := base64.StdEncoding.EncodeToString([]byte(testPrivateKeyPEM))
	appID := "123456"

	t.Run("generates valid JWT token", func(t *testing.T) {
		token, err := github.GenerateJWTToken(appID, common.RawSecureValue(privateKeyBase64))
		require.NoError(t, err)
		assert.NotEmpty(t, token)

		// Parse and verify token
		parsedToken, _, err := new(jwt.Parser).ParseUnverified(string(token), &jwt.RegisteredClaims{})
		require.NoError(t, err)

		claims := parsedToken.Claims.(*jwt.RegisteredClaims)
		assert.Equal(t, appID, claims.Issuer)

		// Verify expiration is ~10 minutes
		expiresIn := claims.ExpiresAt.Time.Sub(claims.IssuedAt.Time)
		assert.InDelta(t, 10*time.Minute, expiresIn, float64(time.Second))
	})

	t.Run("fails with invalid base64", func(t *testing.T) {
		_, err := github.GenerateJWTToken(appID, common.RawSecureValue("invalid!@#"))
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "decode base64")
	})

	t.Run("fails with invalid PEM", func(t *testing.T) {
		invalidPEM := base64.StdEncoding.EncodeToString([]byte("not a PEM"))
		_, err := github.GenerateJWTToken(appID, common.RawSecureValue(invalidPEM))
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "parse private key")
	})
}
