package grpc

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/http"
	"strconv"

	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"

	authnlib "github.com/grafana/authlib/authn"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

type ClientInterceptor struct {
	clientCfg   *authClientCfg
	tokenClient authnlib.TokenExchanger
	tokenReq    authnlib.TokenExchangeRequest
	logger      log.Logger
}

// NewServiceClientInterceptor creates a new client interceptor for service clients (with no user involved)
func NewServiceClientInterceptor(cfg *setting.Cfg, tokenReq authnlib.TokenExchangeRequest) (*ClientInterceptor, error) {
	return newClientInterceptor(cfg, tokenReq, false)
}

// NewClientInterceptor creates a new client interceptor for clients that require user information.
func NewClientInterceptor(cfg *setting.Cfg, tokenReq authnlib.TokenExchangeRequest) (*ClientInterceptor, error) {
	return newClientInterceptor(cfg, tokenReq, true)
}

func newClientInterceptor(cfg *setting.Cfg, tokenReq authnlib.TokenExchangeRequest, withUser bool) (*ClientInterceptor, error) {
	var (
		tokenClient authnlib.TokenExchanger
		err         error
		logger      = log.New("authz.client")
		clientCfg   = readAuthClientConfig(cfg)
	)

	clientCfg.withUser = withUser

	if clientCfg.accessTokenEnabled {
		if clientCfg.token == "" {
			return nil, fmt.Errorf("token is required")
		}
		if clientCfg.tokenExchangeURL == "" {
			return nil, fmt.Errorf("token exchange URL is required")
		}
		client := http.DefaultClient
		if setting.Env == setting.Dev {
			client = &http.Client{Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}}}
		}
		tokenClient, err = authnlib.NewTokenExchangeClient(
			authnlib.TokenExchangeConfig{TokenExchangeURL: clientCfg.tokenExchangeURL, Token: clientCfg.token},
			authnlib.WithHTTPClient(client),
		)
		if err != nil {
			return nil, err
		}
	} else if setting.Env != setting.Dev {
		logger.Warn("access token is disabled")
	}

	return &ClientInterceptor{
		clientCfg:   clientCfg,
		tokenClient: tokenClient,
		tokenReq:    tokenReq,
		logger:      logger,
	}, nil
}

func (h *ClientInterceptor) UnaryClientInterceptor(ctx context.Context, method string, req, reply interface{}, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
	ctx, err := h.wrapContext(ctx)
	if err != nil {
		return err
	}
	return invoker(ctx, method, req, reply, cc, opts...)
}

func (h *ClientInterceptor) StreamClientInterceptor(ctx context.Context, desc *grpc.StreamDesc, cc *grpc.ClientConn, method string, streamer grpc.Streamer, opts ...grpc.CallOption) (grpc.ClientStream, error) {
	ctx, err := h.wrapContext(ctx)
	if err != nil {
		return nil, err
	}
	return streamer(ctx, desc, cc, method, opts...)
}

// wrapContext wraps adds authentication information to the outgoing context.
func (h *ClientInterceptor) wrapContext(ctx context.Context) (context.Context, error) {
	ctxLogger := h.logger.FromContext(ctx)

	md := metadata.Pairs()

	if h.clientCfg.withUser {
		user, err := identity.GetRequester(ctx)
		if err != nil {
			ctxLogger.Error("Error getting requester", "error", err)
			return nil, err
		}

		md.Set(mdToken, user.GetIDToken())
		md.Set(mdOrgID, strconv.FormatInt(user.GetOrgID(), 10))
	}

	// TODO (gamab): set OrgID when no user is present

	if !h.clientCfg.accessTokenEnabled {
		ctxLogger.Info("not adding access token to outgoing context: access token is disabled")
		return metadata.NewOutgoingContext(ctx, md), nil
	}

	ctxLogger.Info("Exchanging token for access token")
	token, err := h.tokenClient.Exchange(ctx, h.tokenReq)
	if err != nil {
		ctxLogger.Error("Error exchanging token for access token", "error", err)
		return nil, err
	}

	md.Set(mdAccessToken, token.Token)
	return metadata.NewOutgoingContext(ctx, md), nil
}
