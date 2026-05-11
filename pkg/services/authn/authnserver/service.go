package authnserver

import (
	"context"
	"errors"
	"slices"
	"strings"

	grpclog "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/logging"
	"go.opentelemetry.io/otel/attribute"
	"k8s.io/apiserver/pkg/endpoints/request"

	authnv1 "github.com/grafana/authlib/authn/proto/v1"

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
// registered Clients. Clients are tried in registration order.
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

		resp, err := c.Authenticate(ctx, req)
		if err != nil {
			s.log.Error("Client authentication error", "client", c.Name(), "error", err)
			grpclog.AddFields(ctx, grpclog.Fields{"authn.client", c.Name(), "authn.namespace", req.GetNamespace()})
			return nil, err
		}

		if resp.Code != authnv1.AuthenticateCode_AUTHENTICATE_CODE_NOT_HANDLED {
			grpclog.AddFields(ctx, grpclog.Fields{"authn.client", c.Name(), "authn.code", resp.Code.String(), "authn.namespace", req.GetNamespace()})
			return resp, nil
		}
	}

	grpclog.AddFields(ctx, grpclog.Fields{"authn.client", "none", "authn.code", authnv1.AuthenticateCode_AUTHENTICATE_CODE_NOT_HANDLED.String(), "authn.namespace", req.GetNamespace()})
	return &authnv1.AuthenticateResponse{
		Code: authnv1.AuthenticateCode_AUTHENTICATE_CODE_NOT_HANDLED,
	}, nil
}

func headerNames(headers map[string]string) string {
	names := make([]string, 0, len(headers))
	for k := range headers {
		names = append(names, k)
	}
	slices.Sort(names)
	return strings.Join(names, ",")
}
