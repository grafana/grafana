package authnserver

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strings"

	grpclog "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/logging"
	"go.opentelemetry.io/otel/attribute"
	"k8s.io/apiserver/pkg/endpoints/request"

	authnlib "github.com/grafana/authlib/authn"
	authnv1 "github.com/grafana/authlib/authn/proto/v1"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	grafanaauthn "github.com/grafana/grafana/pkg/services/authn"
)

var (
	errExpectedNamespace            = errors.New("expected namespace")
	errExpectedAuthenticationResult = errors.New("expected authentication result")
)

// CompletionStatus describes the terminal outer-loop processing result for an
// authenticator that returned OK.
type CompletionStatus int

const (
	CompletionStatusOK CompletionStatus = iota
	CompletionStatusPostAuthHookFailed
	CompletionStatusIdentityDisabled
	CompletionStatusTokenExchangeFailed
	CompletionStatusInternalError
)

// AuthenticationResult is the common result returned by every MT auth client.
// The service turns successful results into the wire-level AuthenticateResponse
// after running post-auth hooks and exchanging the authenticated identity.
type AuthenticationResult struct {
	Code authnv1.AuthenticateCode

	Identity *grafanaauthn.Identity
	Request  *grafanaauthn.Request

	// SubjectToken overrides identity-based OBO exchange. Ext-JWT uses the
	// already-verified incoming token while session auth leaves this empty.
	SubjectToken string

	// RequestHeaders contains client-specific headers that are added alongside
	// the access-token headers produced by the outer exchange.
	RequestHeaders map[string]string

	// ResolveRequestHeaders defers work that can mutate authentication state,
	// such as refreshing an OAuth token, until all hooks and token exchange have
	// succeeded.
	ResolveRequestHeaders func(context.Context) map[string]string

	ResponseBody []byte
}

// Client is the interface that MT auth clients implement.
// This is the MT equivalent of authn.ContextAwareClient, but operating
// on proto types instead of authn.Request/Identity.
type Client interface {
	// Name returns the client identifier (for logging/metrics).
	Name() string
	// Test reports whether this client can handle the request.
	// Implementations should be cheap (header presence checks, no I/O).
	Test(ctx context.Context, req *authnv1.AuthenticateRequest) bool
	// Authenticate performs authentication. Returns OK or FAILED.
	// May return NOT_HANDLED to signal "not my credentials,
	// try the next client."
	Authenticate(ctx context.Context, req *authnv1.AuthenticateRequest) (*AuthenticationResult, error)
}

// CompletionObserver can be implemented by a client that needs to record the
// terminal status of common outer-loop processing. The service determines the
// status; the client only observes it.
type CompletionObserver interface {
	AuthenticationCompleted(CompletionStatus)
}

// Service implements authnv1.AuthnServiceServer by dispatching to
// registered Clients. Clients are tried in registration order.
type Service struct {
	authnv1.UnimplementedAuthnServiceServer

	clients []Client
	log     log.Logger
	tracer  tracing.Tracer

	exchanger     authnlib.TokenExchanger
	audiences     []string
	postAuthHooks []grafanaauthn.PostAuthHookFn
}

func NewService(tracer tracing.Tracer, exchanger authnlib.TokenExchanger, audiences []string) *Service {
	return &Service{
		log:       log.New("authn.server"),
		tracer:    tracer,
		exchanger: exchanger,
		audiences: audiences,
	}
}

func (s *Service) RegisterClient(c Client) {
	s.clients = append(s.clients, c)
}

func (s *Service) RegisterPostAuthHook(hook grafanaauthn.PostAuthHookFn) {
	s.postAuthHooks = append(s.postAuthHooks, hook)
}

func (s *Service) Authenticate(ctx context.Context, req *authnv1.AuthenticateRequest) (*authnv1.AuthenticateResponse, error) {
	ctx, span := s.tracer.Start(ctx, "authnserver.Authenticate")
	defer span.End()

	if req == nil || req.Namespace == "" {
		s.log.Error("Authenticate request error", "error", errExpectedNamespace)
		return &authnv1.AuthenticateResponse{
			Code: authnv1.AuthenticateCode_AUTHENTICATE_CODE_FAILED,
		}, errExpectedNamespace
	}

	ctx = request.WithNamespace(ctx, req.Namespace)
	span.SetAttributes(attribute.String("authn.namespace", req.Namespace))

	grpclog.AddFields(ctx, grpclog.Fields{"authn.headers", headerNames(req.GetHttpHeaders())})

	for _, c := range s.clients {
		if !c.Test(ctx, req) {
			continue
		}

		span.SetAttributes(attribute.String("authn.client", c.Name()))

		result, err := c.Authenticate(ctx, req)
		if err != nil {
			s.log.Error("Client authentication error", "client", c.Name(), "error", err)
			grpclog.AddFields(ctx, grpclog.Fields{"authn.client", c.Name(), "authn.namespace", req.GetNamespace()})
			return nil, err
		}
		if result == nil {
			err := fmt.Errorf("%w from client %q", errExpectedAuthenticationResult, c.Name())
			s.log.Error("Client authentication error", "client", c.Name(), "error", err)
			return nil, err
		}

		if result.Code != authnv1.AuthenticateCode_AUTHENTICATE_CODE_NOT_HANDLED {
			resp, completionStatus, err := s.response(ctx, req, c, result)
			if result.Code == authnv1.AuthenticateCode_AUTHENTICATE_CODE_OK {
				if observer, ok := c.(CompletionObserver); ok {
					observer.AuthenticationCompleted(completionStatus)
				}
			}
			if err != nil {
				s.log.Error("Client authentication result error", "client", c.Name(), "error", err)
				grpclog.AddFields(ctx, grpclog.Fields{"authn.client", c.Name(), "authn.namespace", req.GetNamespace()})
				return nil, err
			}
			grpclog.AddFields(ctx, grpclog.Fields{"authn.client", c.Name(), "authn.code", resp.Code.String(), "authn.namespace", req.GetNamespace()})
			return resp, nil
		}
	}

	grpclog.AddFields(ctx, grpclog.Fields{"authn.client", "none", "authn.code", authnv1.AuthenticateCode_AUTHENTICATE_CODE_NOT_HANDLED.String(), "authn.namespace", req.GetNamespace()})
	return &authnv1.AuthenticateResponse{
		Code: authnv1.AuthenticateCode_AUTHENTICATE_CODE_NOT_HANDLED,
	}, nil
}

func (s *Service) response(ctx context.Context, req *authnv1.AuthenticateRequest, client Client, result *AuthenticationResult) (*authnv1.AuthenticateResponse, CompletionStatus, error) {
	if result.Code != authnv1.AuthenticateCode_AUTHENTICATE_CODE_OK {
		return &authnv1.AuthenticateResponse{
			Code:           result.Code,
			RequestHeaders: result.RequestHeaders,
			ResponseBody:   result.ResponseBody,
		}, CompletionStatusInternalError, nil
	}

	if result.Identity == nil || result.Request == nil {
		return nil, CompletionStatusInternalError, fmt.Errorf("%w from client %q: successful result requires identity and request", errExpectedAuthenticationResult, client.Name())
	}

	for _, hook := range s.postAuthHooks {
		if err := hook(ctx, result.Identity, result.Request); err != nil {
			s.log.Info("Post-auth hook failed", "client", client.Name(), "error", err)
			return failedResponse(ctx), CompletionStatusPostAuthHookFailed, nil
		}
	}
	if result.Identity.IsDisabled {
		s.log.Info("Authenticated identity is disabled", "client", client.Name(), "identity", result.Identity.GetSubject())
		return failedResponse(ctx), CompletionStatusIdentityDisabled, nil
	}
	if s.exchanger == nil {
		return nil, CompletionStatusInternalError, fmt.Errorf("%w from client %q: token exchanger is not configured", errExpectedAuthenticationResult, client.Name())
	}

	exchangeReq := authnlib.TokenExchangeRequest{
		Namespace: req.GetNamespace(),
		Audiences: s.audiences,
	}
	if result.SubjectToken != "" {
		exchangeReq.SubjectToken = result.SubjectToken
	} else {
		exchangeReq.Subject = identityToSubject(result.Identity, req.GetNamespace())
	}

	exchanged, err := s.exchanger.Exchange(ctx, exchangeReq)
	if err != nil {
		s.log.Error("OBO token exchange failed", "client", client.Name(), "error", err)
		return failedResponse(ctx), CompletionStatusTokenExchangeFailed, nil
	}

	headers := make(map[string]string, len(result.RequestHeaders)+2)
	for name, value := range result.RequestHeaders {
		headers[name] = value
	}
	if result.ResolveRequestHeaders != nil {
		for name, value := range result.ResolveRequestHeaders(ctx) {
			headers[name] = value
		}
	}
	bearer := "Bearer " + exchanged.Token
	headers["X-Access-Token"] = bearer
	headers["Authorization"] = bearer

	return &authnv1.AuthenticateResponse{
		Code:           authnv1.AuthenticateCode_AUTHENTICATE_CODE_OK,
		RequestHeaders: headers,
	}, CompletionStatusOK, nil
}

func identityToSubject(ident *grafanaauthn.Identity, namespace string) *authnlib.TokenExchangeSubject {
	return &authnlib.TokenExchangeSubject{
		Sub:             ident.GetSubject(),
		Identifier:      ident.GetRawIdentifier(),
		Type:            string(ident.GetIdentityType()),
		Namespace:       namespace,
		AuthenticatedBy: ident.GetAuthenticatedBy(),
		Email:           ident.GetEmail(),
		EmailVerified:   ident.GetEmailVerified(),
		Username:        ident.GetLogin(),
		DisplayName:     ident.GetName(),
		Role:            string(ident.GetOrgRole()),
		Groups:          ident.GetGroups(),
	}
}

func failedResponse(ctx context.Context) *authnv1.AuthenticateResponse {
	body, _ := json.Marshal(map[string]any{
		"traceID": tracing.TraceIDFromContext(ctx, false),
		"message": http.StatusText(http.StatusUnauthorized),
	})
	return &authnv1.AuthenticateResponse{
		Code:         authnv1.AuthenticateCode_AUTHENTICATE_CODE_FAILED,
		ResponseBody: body,
	}
}

func headerNames(headers map[string]string) string {
	names := make([]string, 0, len(headers))
	for k := range headers {
		names = append(names, k)
	}
	slices.Sort(names)
	return strings.Join(names, ",")
}
