package client

import (
	"context"
	"testing"

	"github.com/fullstorydev/grpchan/inprocgrpc"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/prometheus/client_golang/prometheus"
	promtest "github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol/shadow"
)

type listTestServer struct {
	authzv1.UnimplementedAuthzServiceServer
}

func (listTestServer) List(context.Context, *authzv1.ListRequest) (*authzv1.ListResponse, error) {
	return &authzv1.ListResponse{Items: []string{"one"}}, nil
}

func TestListShadowSkipsProductionLatencyMetric(t *testing.T) {
	channel := &inprocgrpc.Channel{}
	authzv1.RegisterAuthzServiceServer(channel, listTestServer{})
	client, err := New(channel, prometheus.NewRegistry())
	require.NoError(t, err)
	req := &authzv1.ListRequest{Namespace: "default"}

	res, err := client.List(shadow.WithContext(t.Context()), req)
	require.NoError(t, err)
	require.Equal(t, []string{"one"}, res.GetItems())
	require.Zero(t, promtest.CollectAndCount(client.metrics.requestDurationSeconds))

	_, err = client.List(t.Context(), req)
	require.NoError(t, err)
	require.Equal(t, 1, promtest.CollectAndCount(client.metrics.requestDurationSeconds))
}
