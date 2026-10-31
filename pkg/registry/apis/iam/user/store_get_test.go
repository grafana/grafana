package user

import (
	"context"
	"errors"
	"testing"
	"time"

	claims "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apiserver/pkg/endpoints/request"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	legacyuser "github.com/grafana/grafana/pkg/services/user"
)

type getUserStore struct {
	legacy.LegacyIdentityStore
	result *legacy.ListUserResult
	err    error
	query  legacy.ListUserQuery
}

func (s *getUserStore) ListUsers(_ context.Context, _ claims.NamespaceInfo, query legacy.ListUserQuery) (*legacy.ListUserResult, error) {
	s.query = query
	return s.result, s.err
}

func TestLegacyStoreGet(t *testing.T) {
	ctx := request.WithNamespace(t.Context(), "default")
	backendErr := errors.New("backend unavailable")
	now := time.Unix(100, 0)
	for _, tc := range []struct {
		name     string
		result   *legacy.ListUserResult
		err      error
		notFound bool
		disabled bool
	}{
		{name: "backend error", err: backendErr},
		{name: "nil result", notFound: true},
		{name: "successful absence", result: &legacy.ListUserResult{}, notFound: true},
		{name: "active user", result: &legacy.ListUserResult{Items: []common.UserWithRole{{User: legacyuser.User{UID: "alice", Login: "alice", Email: "alice@example.com", Created: now, Updated: now}}}}},
		{name: "disabled user", result: &legacy.ListUserResult{Items: []common.UserWithRole{{User: legacyuser.User{UID: "alice", Login: "alice", Email: "alice@example.com", IsDisabled: true, Created: now, Updated: now}}}}, disabled: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			backend := &getUserStore{result: tc.result, err: tc.err}
			store := NewLegacyStore(backend, nil, noop.NewTracerProvider().Tracer("test"))
			obj, err := store.Get(ctx, "alice", nil)
			require.Equal(t, "alice", backend.query.UID)
			require.Equal(t, int64(1), backend.query.OrgID)
			if tc.err != nil {
				require.Nil(t, obj)
				require.ErrorIs(t, err, tc.err)
				require.False(t, apierrors.IsNotFound(err))
				return
			}
			if tc.notFound {
				require.Nil(t, obj)
				require.True(t, apierrors.IsNotFound(err))
				return
			}
			require.NoError(t, err)
			user := obj.(*iamv0alpha1.User)
			require.Equal(t, "alice", user.Name)
			require.Equal(t, "default", user.Namespace)
			require.Equal(t, "alice", user.Spec.Login)
			require.Equal(t, "alice@example.com", user.Spec.Email)
			require.Equal(t, tc.disabled, user.Spec.Disabled)
		})
	}
}
