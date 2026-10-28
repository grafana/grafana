package router

import (
	"context"
	"errors"
	"net/http/httptest"
	"testing"

	"github.com/grafana/authlib/authn"
	"github.com/stretchr/testify/require"
)

func TestAuthFailureOutcome(t *testing.T) {
	require.Nil(t, withAuthFailureOutcome(nil))

	failing := withAuthFailureOutcome(failingExchanger{})
	req, outcome := withRequestOutcome(httptest.NewRequest("GET", "/apis/test.ext.grafana.app/v1/things", nil))
	_, err := failing.Exchange(req.Context(), authn.TokenExchangeRequest{})
	require.Error(t, err)
	require.Equal(t, failureAuth, outcome.failure)

	t.Run("abandoned requests are not auth failures", func(t *testing.T) {
		req, outcome := withRequestOutcome(httptest.NewRequest("GET", "/apis/test.ext.grafana.app/v1/things", nil))
		ctx, cancel := context.WithCancel(req.Context())
		cancel()
		_, err := failing.Exchange(ctx, authn.TokenExchangeRequest{})
		require.Error(t, err)
		require.Empty(t, outcome.failure)
	})

	t.Run("successful exchanges", func(t *testing.T) {
		req, outcome := withRequestOutcome(httptest.NewRequest("GET", "/apis/test.ext.grafana.app/v1/things", nil))
		_, err := withAuthFailureOutcome(authn.NewStaticTokenExchanger("token")).Exchange(req.Context(), authn.TokenExchangeRequest{})
		require.NoError(t, err)
		require.Empty(t, outcome.failure)
	})
}

type failingExchanger struct{}

func (failingExchanger) Exchange(context.Context, authn.TokenExchangeRequest) (*authn.TokenExchangeResponse, error) {
	return nil, errors.New("token exchange failed")
}
