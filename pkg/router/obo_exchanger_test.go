package router

import (
	"context"
	"testing"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

type stubTokenExchanger struct {
	lastReq authnlib.TokenExchangeRequest
	resp    *authnlib.TokenExchangeResponse
	err     error
}

func (s *stubTokenExchanger) Exchange(_ context.Context, req authnlib.TokenExchangeRequest) (*authnlib.TokenExchangeResponse, error) {
	s.lastReq = req
	return s.resp, s.err
}

func namespacedRequestCtx(ctx context.Context, namespace string) context.Context {
	return request.WithRequestInfo(ctx, &request.RequestInfo{
		IsResourceRequest: true,
		Namespace:         namespace,
		Verb:              "create",
		APIGroup:          "customcrdtest.ext.grafana.app",
		Resource:          "widgets",
	})
}

func TestOboTokenExchanger_Exchange(t *testing.T) {
	t.Run("injects access token and namespace from requester", func(t *testing.T) {
		delegate := &stubTokenExchanger{resp: &authnlib.TokenExchangeResponse{Token: "obo-token"}}
		exchanger := &oboTokenExchanger{delegate: delegate}

		requester := &identity.StaticRequester{
			Type:        types.TypeServiceAccount,
			UserUID:     "service-identity-uid",
			AccessToken: "caller-access-token",
			Namespace:   "stacks-11",
		}
		ctx := namespacedRequestCtx(identity.WithRequester(context.Background(), requester), "stacks-11")

		resp, err := exchanger.Exchange(ctx, authnlib.TokenExchangeRequest{
			Namespace: "*",
			Audiences: []string{"resourceStore"},
		})
		require.NoError(t, err)
		require.Equal(t, "obo-token", resp.Token)
		assert.Equal(t, "caller-access-token", delegate.lastReq.SubjectToken)
		assert.Equal(t, "stacks-11", delegate.lastReq.Namespace)
	})

	t.Run("denies request when access token is absent", func(t *testing.T) {
		delegate := &stubTokenExchanger{resp: &authnlib.TokenExchangeResponse{Token: "obo-token"}}
		exchanger := &oboTokenExchanger{delegate: delegate}

		requester := &identity.StaticRequester{
			Type:      types.TypeUser,
			UserUID:   "user-uid",
			Namespace: "stacks-42",
		}
		ctx := namespacedRequestCtx(identity.WithRequester(context.Background(), requester), "stacks-42")

		_, err := exchanger.Exchange(ctx, authnlib.TokenExchangeRequest{Namespace: "*"})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "denied request")
	})

	t.Run("denies request when no requester in context", func(t *testing.T) {
		delegate := &stubTokenExchanger{resp: &authnlib.TokenExchangeResponse{Token: "obo-token"}}
		exchanger := &oboTokenExchanger{delegate: delegate}

		ctx := namespacedRequestCtx(context.Background(), "stacks-11")

		_, err := exchanger.Exchange(ctx, authnlib.TokenExchangeRequest{Namespace: "*"})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "no requester in context")
	})

	t.Run("preserves wildcard namespace when requester namespace is empty", func(t *testing.T) {
		delegate := &stubTokenExchanger{resp: &authnlib.TokenExchangeResponse{Token: "obo-token"}}
		exchanger := &oboTokenExchanger{delegate: delegate}

		requester := &identity.StaticRequester{
			Type:        types.TypeServiceAccount,
			AccessToken: "caller-access-token",
			Namespace:   "",
		}
		ctx := namespacedRequestCtx(identity.WithRequester(context.Background(), requester), "stacks-11")

		_, err := exchanger.Exchange(ctx, authnlib.TokenExchangeRequest{Namespace: "*"})
		require.NoError(t, err)
		assert.Equal(t, "caller-access-token", delegate.lastReq.SubjectToken)
		assert.Equal(t, "*", delegate.lastReq.Namespace)
	})

	t.Run("preserves wildcard namespace when requester namespace is wildcard", func(t *testing.T) {
		delegate := &stubTokenExchanger{resp: &authnlib.TokenExchangeResponse{Token: "obo-token"}}
		exchanger := &oboTokenExchanger{delegate: delegate}

		requester := &identity.StaticRequester{
			Type:        types.TypeServiceAccount,
			AccessToken: "caller-access-token",
			Namespace:   "*",
		}
		ctx := namespacedRequestCtx(identity.WithRequester(context.Background(), requester), "stacks-11")

		_, err := exchanger.Exchange(ctx, authnlib.TokenExchangeRequest{Namespace: "*"})
		require.NoError(t, err)
		assert.Equal(t, "caller-access-token", delegate.lastReq.SubjectToken)
		assert.Equal(t, "*", delegate.lastReq.Namespace)
	})
}
