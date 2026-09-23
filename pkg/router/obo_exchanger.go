package router

import (
	"context"
	"errors"

	authnlib "github.com/grafana/authlib/authn"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
)

var oboExchangerLog = log.New("obo-exchanger")

// oboTokenExchanger decorates a TokenExchanger to inject the caller's access
// token as SubjectToken, producing an OBO token for cross-pod storage calls.
// Missing caller credentials must fail rather than fall back to service identity.
type oboTokenExchanger struct {
	delegate authnlib.TokenExchanger
}

func (e *oboTokenExchanger) Exchange(ctx context.Context, req authnlib.TokenExchangeRequest) (*authnlib.TokenExchangeResponse, error) {
	ctxlog := oboExchangerLog.FromContext(ctx)

	requester, err := identity.GetRequester(ctx)
	if err != nil {
		ctxlog.Debug("no requester in context", "error", err)
		return nil, errors.New("denied request, no requester in context")
	}

	at := requester.GetAccessToken()
	if at == "" {
		ctxlog.Error(
			"no access token available on requester",
			"subject", requester.GetSubject(),
			"identity_type", requester.GetIdentityType(),
		)
		return nil, errors.New("denied request")
	}

	req.SubjectToken = at
	if ns := requester.GetNamespace(); ns != "" && ns != "*" {
		req.Namespace = ns
	}

	ctxlog.Debug(
		"injecting SubjectToken from access token",
		"subject", requester.GetSubject(),
		"identity_type", requester.GetIdentityType(),
		"namespace", req.Namespace,
	)

	return e.delegate.Exchange(ctx, req)
}
