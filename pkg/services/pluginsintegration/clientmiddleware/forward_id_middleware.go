package clientmiddleware

import (
	"context"

	authnlib "github.com/grafana/authlib/authn"
	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/util"
)

const forwardIDHeaderName = "X-Grafana-Id"

// NewForwardIDMiddleware creates a new backend.HandlerMiddleware that will
// set grafana id header on outgoing backend.Handler requests. idTokenDeriver mints an id token
// from a requester's OBO access token when the requester carries no id token of its own (the MT
// case, where the edge no longer mints one); nil disables that fallback, leaving the header unset
// in that case, which is correct for callers (e.g. single-tenant Grafana) that always populate
// GetIDToken() themselves.
func NewForwardIDMiddleware(idTokenDeriver authnlib.IDTokenDeriver) backend.HandlerMiddleware {
	return backend.HandlerMiddlewareFunc(func(next backend.Handler) backend.Handler {
		return &ForwardIDMiddleware{
			log:            log.New("forward_id_middleware"),
			idTokenDeriver: idTokenDeriver,
			BaseHandler:    backend.NewBaseHandler(next),
		}
	})
}

type ForwardIDMiddleware struct {
	log            log.Logger
	idTokenDeriver authnlib.IDTokenDeriver

	backend.BaseHandler
}

func (m *ForwardIDMiddleware) applyToken(ctx context.Context, _ backend.PluginContext, req backend.ForwardHTTPHeaders) error {
	if req == nil {
		return nil
	}

	// Resolved below only if a requester is present; a missing requester (or a derive failure)
	// must still clear any stale header rather than silently forward whatever was already set,
	// so this stays empty rather than early-returning on the "no requester" path.
	var requester identity.Requester
	reqCtx := contexthandler.FromContext(ctx)
	if reqCtx != nil && reqCtx.SignedInUser != nil {
		requester = reqCtx.SignedInUser
	} else if r, err := identity.GetRequester(ctx); err == nil {
		requester = r
	} else {
		m.log.Debug("Failed to get requester from context", "error", err)
	}

	var token string
	if requester != nil {
		token = requester.GetIDToken()
		if token == "" {
			token = m.deriveIDToken(ctx, requester)
		}
	}

	// Set-or-delete rather than "set only on success": a header a previous hop or a reused
	// context left behind must not survive an empty result unverified.
	if token != "" {
		req.SetHTTPHeader(forwardIDHeaderName, token)
	} else {
		req.DeleteHTTPHeader(forwardIDHeaderName)
	}

	return nil
}

// deriveIDToken mints an id token from requester's OBO access token, for the case where
// requester carries no id token of its own. It only does so for a user or service account actor:
// a requester with neither (e.g. a machine/service identity with no user in its actor chain) has
// no identity for a plugin backend to key off of, so leaving the header unset is correct, not an
// error condition.
func (m *ForwardIDMiddleware) deriveIDToken(ctx context.Context, requester identity.Requester) string {
	if util.IsInterfaceNil(m.idTokenDeriver) {
		return ""
	}

	if !requester.IsIdentityType(claims.TypeUser, claims.TypeServiceAccount) {
		return ""
	}

	accessToken := requester.GetAccessToken()
	if accessToken == "" {
		return ""
	}

	resp, err := m.idTokenDeriver.DeriveIDToken(ctx, accessToken, requester.GetNamespace())
	if err != nil {
		m.log.Warn("Failed to derive id token from access token", "error", err)
		return ""
	}

	return resp.Token
}

func (m *ForwardIDMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if req == nil {
		return m.BaseHandler.QueryData(ctx, req)
	}

	err := m.applyToken(ctx, req.PluginContext, req)
	if err != nil {
		return nil, err
	}

	return m.BaseHandler.QueryData(ctx, req)
}

func (m *ForwardIDMiddleware) QueryChunkedData(ctx context.Context, req *backend.QueryChunkedDataRequest, w backend.ChunkedDataWriter) error {
	if req == nil {
		return m.BaseHandler.QueryChunkedData(ctx, req, w)
	}

	err := m.applyToken(ctx, req.PluginContext, req)
	if err != nil {
		return err
	}

	return m.BaseHandler.QueryChunkedData(ctx, req, w)
}

func (m *ForwardIDMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if req == nil {
		return m.BaseHandler.CallResource(ctx, req, sender)
	}

	err := m.applyToken(ctx, req.PluginContext, req)
	if err != nil {
		return err
	}

	return m.BaseHandler.CallResource(ctx, req, sender)
}

func (m *ForwardIDMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if req == nil {
		return m.BaseHandler.CheckHealth(ctx, req)
	}

	err := m.applyToken(ctx, req.PluginContext, req)
	if err != nil {
		return nil, err
	}

	return m.BaseHandler.CheckHealth(ctx, req)
}

func (m *ForwardIDMiddleware) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	if req == nil {
		return m.BaseHandler.SubscribeStream(ctx, req)
	}

	err := m.applyToken(ctx, req.PluginContext, req)
	if err != nil {
		return nil, err
	}

	return m.BaseHandler.SubscribeStream(ctx, req)
}

func (m *ForwardIDMiddleware) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	if req == nil {
		return m.BaseHandler.PublishStream(ctx, req)
	}

	err := m.applyToken(ctx, req.PluginContext, req)
	if err != nil {
		return nil, err
	}

	return m.BaseHandler.PublishStream(ctx, req)
}

func (m *ForwardIDMiddleware) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	if req == nil {
		return m.BaseHandler.RunStream(ctx, req, sender)
	}

	err := m.applyToken(ctx, req.PluginContext, req)
	if err != nil {
		return err
	}

	return m.BaseHandler.RunStream(ctx, req, sender)
}
