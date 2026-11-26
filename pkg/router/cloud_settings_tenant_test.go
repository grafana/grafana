package router

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/metadata"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func TestStackIDMiddleware(t *testing.T) {
	var got metadata.MD
	calls := 0
	next := &backend.Handlers{
		CheckHealthHandler: backend.CheckHealthHandlerFunc(func(ctx context.Context, _ *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
			calls++
			got, _ = metadata.FromOutgoingContext(ctx)
			return &backend.CheckHealthResult{Status: backend.HealthStatusOk}, nil
		}),
		CallResourceHandler: backend.CallResourceHandlerFunc(func(ctx context.Context, _ *backend.CallResourceRequest, _ backend.CallResourceResponseSender) error {
			calls++
			got, _ = metadata.FromOutgoingContext(ctx)
			return nil
		}),
	}
	h, err := backend.HandlerFromMiddlewares(next, newStackIDMiddleware())
	require.NoError(t, err)

	call := map[string]func(ctx context.Context, ns string) error{
		"health": func(ctx context.Context, ns string) error {
			_, err := h.CheckHealth(ctx, &backend.CheckHealthRequest{PluginContext: backend.PluginContext{Namespace: ns}})
			return err
		},
		"resources": func(ctx context.Context, ns string) error {
			sender := backend.CallResourceResponseSenderFunc(func(*backend.CallResourceResponse) error { return nil })
			return h.CallResource(ctx, &backend.CallResourceRequest{PluginContext: backend.PluginContext{Namespace: ns}}, sender)
		},
	}
	for name, call := range call {
		t.Run(name, func(t *testing.T) {
			calls, got = 0, nil
			require.NoError(t, call(t.Context(), "stacks-31701"))
			require.Equal(t, []string{"31701"}, got.Get(stackIDMetadataKey))
			require.Equal(t, []string{"slug-for-stacks-31701"}, got.Get(slugMetadataKey))

			// A value already on the context is replaced, not sent alongside.
			ctx := metadata.AppendToOutgoingContext(t.Context(), stackIDMetadataKey, "1", "other", "kept")
			require.NoError(t, call(ctx, "stacks-31701"))
			require.Equal(t, []string{"31701"}, got.Get(stackIDMetadataKey))
			require.Equal(t, []string{"kept"}, got.Get("other"))

			// Without a stack there is no tenant to send, so the plugin is not called.
			for _, ns := range []string{"", "default", "org-2", "*"} {
				calls = 0
				err := call(t.Context(), ns)
				require.True(t, apierrors.IsBadRequest(err), "namespace %q: %v", ns, err)
				require.Zero(t, calls, "namespace %q", ns)
			}
		})
	}
}
