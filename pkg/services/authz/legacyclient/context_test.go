package legacyclient

import (
	"testing"

	authzv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
)

func TestLegacyRequesterContextWirePresence(t *testing.T) {
	empty, cacheKey, namespace := "", "caller-cache-key", "stacks-12"
	for _, tc := range []struct {
		name           string
		key, namespace *string
	}{
		{"absent", nil, nil}, {"empty", &empty, &empty}, {"values", &cacheKey, &namespace},
	} {
		t.Run(tc.name, func(t *testing.T) {
			server := &legacyTransportServer{handle: func(req *authzv1.LegacyGetUserPermissionsRequest, _ authzv1.LegacyAuthzService_LegacyGetUserPermissionsServer) error {
				require.Equal(t, tc.key, req.Identity.CacheKey)
				require.Equal(t, tc.namespace, req.Identity.RequesterNamespace)
				return nil
			}}
			req := legacyRequest()
			req.Identity.CacheKey, req.Identity.RequesterNamespace = tc.key, tc.namespace
			_, err := newLegacyTransportClient(t, server).LegacyGetUserPermissions(t.Context(), legacyCaller("stacks-12", "authz.grafana.app/legacyuserpermissions:get"), req)
			require.NoError(t, err)
		})
	}
}

func TestLegacyRequesterContextIsCopied(t *testing.T) {
	rpc := &legacyTestRPC{}
	client := &LegacyClient{clientV1: rpc, tracer: noop.Tracer{}}
	key, namespace := "caller-key", ""
	req := legacyRequest()
	req.Identity.CacheKey, req.Identity.RequesterNamespace = &key, &namespace
	_, err := client.LegacyGetUserPermissions(t.Context(), legacyCaller("stacks-12", "authz.grafana.app/legacyuserpermissions:get"), req)
	require.NoError(t, err)
	key, namespace = "changed", "changed"
	require.Equal(t, "caller-key", *rpc.request.Identity.CacheKey)
	require.Equal(t, "", *rpc.request.Identity.RequesterNamespace)
}
