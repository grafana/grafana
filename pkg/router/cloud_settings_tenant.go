package router

import (
	"context"
	"strconv"

	"github.com/grafana/authlib/types"
	"google.golang.org/grpc/metadata"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// The MT plugin runner reads the tenant from this gRPC metadata. Hosted Grafana
// sends its own stack; the router serves every stack, so it sends the stack of
// the request's namespace.
const (
	stackIDMetadataKey = "stackID"
	// The per-tenant runner requires a slug next to the stack ID. The router does
	// not look up stack slugs, so it sends a placeholder named for the namespace,
	// which still tells stacks apart in the runner's logs and metrics.
	slugMetadataKey = "slug"
)

// newStackIDMiddleware tells the MT plugin runner which stack each v2 settings
// call is for. The runner rejects calls without a stack ID ("no tenant ID found").
func newStackIDMiddleware() backend.HandlerMiddleware {
	return backend.HandlerMiddlewareFunc(func(next backend.Handler) backend.Handler {
		return &stackIDHandler{BaseHandler: backend.NewBaseHandler(next)}
	})
}

type stackIDHandler struct {
	backend.BaseHandler
}

func (h *stackIDHandler) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if req != nil {
		var err error
		if ctx, err = withStackID(ctx, req.PluginContext.Namespace); err != nil {
			return nil, err
		}
	}
	return h.BaseHandler.CheckHealth(ctx, req)
}

func (h *stackIDHandler) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if req != nil {
		var err error
		if ctx, err = withStackID(ctx, req.PluginContext.Namespace); err != nil {
			return err
		}
	}
	return h.BaseHandler.CallResource(ctx, req, sender)
}

func withStackID(ctx context.Context, namespace string) (context.Context, error) {
	ns, err := types.ParseNamespace(namespace)
	if err != nil || ns.StackID < 1 {
		return ctx, apierrors.NewBadRequest("a stack namespace is required to call the plugin")
	}
	// Set, not append: a caller's value must never reach the runner alongside ours.
	md, _ := metadata.FromOutgoingContext(ctx)
	md = md.Copy()
	md.Set(stackIDMetadataKey, strconv.FormatInt(ns.StackID, 10))
	md.Set(slugMetadataKey, "slug-for-"+ns.Value)
	return metadata.NewOutgoingContext(ctx, md), nil
}
