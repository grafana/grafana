package grpcutils

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v3/jwt"
	"github.com/grafana/authlib/authn"
	"github.com/stretchr/testify/require"
)

const header = "{\"alg\":\"none\",\"typ\":\"at+jwt\"}"

func TestInProcExchanger_Exchange(t *testing.T) {
	t.Run("should cache and return token on successful request", func(t *testing.T) {
		exchanger := ProvideInProcExchanger()

		timeNow = testTime
		tokenExchResponse, err := exchanger.Exchange(context.Background(), authn.TokenExchangeRequest{})

		expectedJWT := createExpectedJWT(t)

		require.NoError(t, err)
		require.NotNil(t, tokenExchResponse)
		require.Equal(t, expectedJWT, tokenExchResponse.Token)

		// Test cache
		timeNow = func() time.Time { return time.Now() }
		tokenExchResponse, err = exchanger.Exchange(context.Background(), authn.TokenExchangeRequest{})

		require.NoError(t, err)
		require.NotNil(t, tokenExchResponse)
		require.Equal(t, expectedJWT, tokenExchResponse.Token)
	})
}

func createExpectedJWT(t *testing.T) string {
	t.Helper()

	expectedClaims := authn.Claims[authn.AccessTokenClaims]{
		Claims: jwt.Claims{
			Audience:  []string{"resourceStore"},
			Expiry:    jwt.NewNumericDate(testTime().Add(5 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(testTime()),
			Issuer:    "grafana",
			NotBefore: jwt.NewNumericDate(testTime()),
		},
		Rest: authn.AccessTokenClaims{
			Namespace:            "*",
			Permissions:          []string{"folder.grafana.app:*", "dashboard.grafana.app:*"},
			DelegatedPermissions: []string{"folder.grafana.app:*", "dashboard.grafana.app:*"},
		}}

	payload, err := json.Marshal(expectedClaims)
	require.NoError(t, err)

	return base64.RawURLEncoding.EncodeToString([]byte(header)) + "." + base64.RawURLEncoding.EncodeToString(payload)
}

func testTime() time.Time {
	return time.Date(2025, time.January, 1, 11, 10, 0, 0, time.UTC)
}
