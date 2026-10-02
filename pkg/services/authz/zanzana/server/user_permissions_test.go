package server

import (
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
)

func TestServerGetUserPermissionsIsUnimplemented(t *testing.T) {
	err := (&Server{}).GetUserPermissions(&authzv1.GetUserPermissionsRequest{}, nil)

	require.Equal(t, codes.Unimplemented, status.Code(err))
}
