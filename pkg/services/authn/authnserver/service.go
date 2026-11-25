package authnserver

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"slices"
	"strings"

	grpclog "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/logging"
	"go.opentelemetry.io/otel/attribute"
	"k8s.io/apiserver/pkg/endpoints/request"

	authnv1 "github.com/grafana/authlib/authn/proto/v1"

	"github.com/grafana/grafana/pkg/infra/features"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
)

var errExpectedNamespace = errors.New("expected namespace")

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
	Authenticate(ctx context.Context, req *authnv1.AuthenticateRequest) (*authnv1.AuthenticateResponse, error)
}

// Service implements authnv1.AuthnServiceServer by dispatching to
// registered Clients. Clients are tried in registration order. A request no
// client's Test claims is rejected as unauthorized.
type Service struct {
	authnv1.UnimplementedAuthnServiceServer

	clients []Client
	log     log.Logger
	tracer  tracing.Tracer
}

func NewService(tracer tracing.Tracer) *Service {
	return &Service{
		log:    log.New("authn.server"),
		tracer: tracer,
	}
}

func (s *Service) RegisterClient(c Client) {
	s.clients = append(s.clients, c)
}

func (s *Service) Authenticate(ctx context.Context, req *authnv1.AuthenticateRequest) (*authnv1.AuthenticateResponse, error) {
	ctx, span := s.tracer.Start(ctx, "authnserver.Authenticate")
	defer span.End()

	if req == nil || req.Namespace == "" {
		s.log.FromContext(ctx).Error("Authenticate request error", "error", errExpectedNamespace)
		return &authnv1.AuthenticateResponse{
			Code: authnv1.AuthenticateCode_AUTHENTICATE_CODE_FAILED,
		}, errExpectedNamespace
	}

	ctx = request.WithNamespace(ctx, req.Namespace)
	ctx = log.WithContextualAttributes(ctx, []any{"namespace", req.Namespace})
	ctx = features.WithTransactionContextFromBaggage(ctx)
	span.SetAttributes(attribute.String("authn.namespace", req.Namespace))

	grpclog.AddFields(ctx, grpclog.Fields{"authn.headers", headerNames(req.GetHttpHeaders())})

	identified := false
	for _, c := range s.clients {
		if !c.Test(ctx, req) {
			continue
		}
		identified = true

		span.SetAttributes(attribute.String("authn.client", c.Name()))

		resp, err := c.Authenticate(ctx, req)
		if err != nil {
			s.log.FromContext(ctx).Error("Client authentication error", "client", c.Name(), "error", err)
			grpclog.AddFields(ctx, grpclog.Fields{"authn.client", c.Name(), "authn.namespace", req.GetNamespace()})
			return nil, err
		}

		if resp.Code != authnv1.AuthenticateCode_AUTHENTICATE_CODE_NOT_HANDLED {
			grpclog.AddFields(ctx, grpclog.Fields{"authn.client", c.Name(), "authn.code", resp.Code.String(), "authn.namespace", req.GetNamespace()})
			return resp, nil
		}
	}

	// Clients claim every auth method a caller may use, including those they
	// defer with NOT_HANDLED, so a request none of them claims carries no usable
	// credentials.
	if !identified {
		grpclog.AddFields(ctx, grpclog.Fields{"authn.client", "none", "authn.code", authnv1.AuthenticateCode_AUTHENTICATE_CODE_FAILED.String(), "authn.namespace", req.GetNamespace()})
		return unauthorized(ctx), nil
	}

	grpclog.AddFields(ctx, grpclog.Fields{"authn.client", "none", "authn.code", authnv1.AuthenticateCode_AUTHENTICATE_CODE_NOT_HANDLED.String(), "authn.namespace", req.GetNamespace()})
	return &authnv1.AuthenticateResponse{
		Code: authnv1.AuthenticateCode_AUTHENTICATE_CODE_NOT_HANDLED,
	}, nil
}

// unauthorized carries a body because callers only relay a FAILED verdict that
// has one. It matches WriteErrOrFallback's 401 body, whose traceID the frontend
// shows in its error toast.
func unauthorized(ctx context.Context) *authnv1.AuthenticateResponse {
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
