package authz

import (
	"context"
	"testing"
	"time"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/types"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	oteltrace "go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

type streamAuthZanzanaServer struct {
	zanzana.Server
	caller        types.AuthInfo
	span          oteltrace.SpanContext
	waitForCancel bool
}

func (s *streamAuthZanzanaServer) GetUserPermissions(_ *authzv1.GetUserPermissionsRequest, stream authzv1.AuthzService_GetUserPermissionsServer) error {
	s.caller, _ = types.AuthInfoFrom(stream.Context())
	s.span = oteltrace.SpanContextFromContext(stream.Context())
	if err := stream.Send(&authzv1.GetUserPermissionsResponse{Permissions: []*authzv1.UserPermission{{Action: "folders:read", Scope: "folders:uid:one"}}}); err != nil {
		return err
	}
	if s.waitForCancel {
		<-stream.Context().Done()
		return stream.Context().Err()
	}
	return nil
}

func TestEmbeddedZanzanaSnapshotAuthenticationAndTrace(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.ZanzanaClient.Mode = setting.ZanzanaModeEmbedded
	server := &streamAuthZanzanaServer{}
	client, err := ProvideZanzanaClient(cfg, nil, server, featuremgmt.WithFeatures(featuremgmt.FlagZanzana), prometheus.NewRegistry())
	require.NoError(t, err)
	snapshot, ok := client.(types.UserPermissionsClient)
	require.True(t, ok)
	provider := sdktrace.NewTracerProvider()
	t.Cleanup(func() { require.NoError(t, provider.Shutdown(context.Background())) })
	ctx, parent := provider.Tracer("test").Start(t.Context(), "snapshot")
	defer parent.End()
	info := delegatedUserPermissionsAuthInfo{AuthInfo: &identity.StaticRequester{Type: types.TypeUser, UserUID: "alice", OrgID: 1}, namespace: "default"}
	result, err := snapshot.GetUserPermissions(ctx, info, types.GetUserPermissionsRequest{Namespace: "default"})
	require.NoError(t, err)
	require.Len(t, result.Permissions, 1)
	require.NotNil(t, server.caller)
	require.Equal(t, "*", server.caller.GetNamespace())
	require.Contains(t, server.caller.GetTokenPermissions(), zanzana.TokenPermissionUserPermissions)
	require.Equal(t, parent.SpanContext().TraceID(), server.span.TraceID())
	require.True(t, server.span.IsRemote())
}

func TestEmbeddedZanzanaSnapshotTimeout(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.ZanzanaClient.Mode = setting.ZanzanaModeEmbedded
	cfg.ZanzanaClient.CallTimeout = 50 * time.Millisecond
	server := &streamAuthZanzanaServer{waitForCancel: true}
	client, err := ProvideZanzanaClient(cfg, nil, server, featuremgmt.WithFeatures(featuremgmt.FlagZanzana), prometheus.NewRegistry())
	require.NoError(t, err)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	watchdog := time.AfterFunc(3*time.Second, cancel)
	defer watchdog.Stop()
	info := delegatedUserPermissionsAuthInfo{AuthInfo: &identity.StaticRequester{Type: types.TypeUser, UserUID: "alice", OrgID: 1}, namespace: "default"}
	result, err := client.GetUserPermissions(ctx, info, types.GetUserPermissionsRequest{Namespace: "default"})
	require.Equal(t, codes.DeadlineExceeded, status.Code(err))
	require.Empty(t, result.Permissions, "a timeout must discard already received chunks")
}
