package controller

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

type mockTokenConnectionWrapper struct {
	connection.Connection
	connection.TokenConnection
}

func TestShouldGenerateToken(t *testing.T) {
	ctx := context.Background()
	resyncInterval := 2 * time.Minute

	t.Run("token is missing - should generate", func(t *testing.T) {
		conn := &provisioning.Connection{
			Secure: provisioning.ConnectionSecure{
				Token: common.InlineSecureValue{}, // Zero value
			},
		}
		mockTokenConn := connection.NewMockTokenConnection(t)

		needsGen, expired, err := shouldGenerateToken(ctx, conn, mockTokenConn, resyncInterval)

		assert.NoError(t, err)
		assert.True(t, needsGen)
		assert.False(t, expired)
	})

	t.Run("token recently created - should not generate", func(t *testing.T) {
		conn := &provisioning.Connection{
			Secure: provisioning.ConnectionSecure{
				Token: common.InlineSecureValue{Name: "existing-token"},
			},
		}
		mockTokenConn := connection.NewMockTokenConnection(t)
		mockTokenConn.EXPECT().TokenCreationTime(ctx).Return(time.Now().Add(-5*time.Second), nil)

		needsGen, expired, err := shouldGenerateToken(ctx, conn, mockTokenConn, resyncInterval)

		assert.NoError(t, err)
		assert.False(t, needsGen)
		assert.False(t, expired)
	})

	t.Run("token expired - should generate with expired flag", func(t *testing.T) {
		conn := &provisioning.Connection{
			Secure: provisioning.ConnectionSecure{
				Token: common.InlineSecureValue{Name: "existing-token"},
			},
		}
		mockTokenConn := connection.NewMockTokenConnection(t)
		mockTokenConn.EXPECT().TokenCreationTime(ctx).Return(time.Now().Add(-15*time.Second), nil)
		mockTokenConn.EXPECT().TokenExpiration(ctx).Return(time.Now().Add(-1*time.Minute), nil)

		needsGen, expired, err := shouldGenerateToken(ctx, conn, mockTokenConn, resyncInterval)

		assert.NoError(t, err)
		assert.True(t, needsGen)
		assert.True(t, expired)
	})

	t.Run("token expiring soon - should generate without expired flag", func(t *testing.T) {
		conn := &provisioning.Connection{
			Secure: provisioning.ConnectionSecure{
				Token: common.InlineSecureValue{Name: "existing-token"},
			},
		}
		mockTokenConn := connection.NewMockTokenConnection(t)
		mockTokenConn.EXPECT().TokenCreationTime(ctx).Return(time.Now().Add(-15*time.Second), nil)
		// Token expires in 2 minutes - within refresh window (2*resyncInterval + 10s = 4m10s)
		mockTokenConn.EXPECT().TokenExpiration(ctx).Return(time.Now().Add(2*time.Minute), nil)

		needsGen, expired, err := shouldGenerateToken(ctx, conn, mockTokenConn, resyncInterval)

		assert.NoError(t, err)
		assert.True(t, needsGen)
		assert.False(t, expired)
	})

	t.Run("token valid and not expiring - should not generate", func(t *testing.T) {
		conn := &provisioning.Connection{
			Secure: provisioning.ConnectionSecure{
				Token: common.InlineSecureValue{Name: "existing-token"},
			},
		}
		mockTokenConn := connection.NewMockTokenConnection(t)
		mockTokenConn.EXPECT().TokenCreationTime(ctx).Return(time.Now().Add(-15*time.Second), nil)
		mockTokenConn.EXPECT().TokenExpiration(ctx).Return(time.Now().Add(10*time.Minute), nil)

		needsGen, expired, err := shouldGenerateToken(ctx, conn, mockTokenConn, resyncInterval)

		assert.NoError(t, err)
		assert.False(t, needsGen)
		assert.False(t, expired)
	})

	t.Run("error getting creation time - should return error", func(t *testing.T) {
		conn := &provisioning.Connection{
			Secure: provisioning.ConnectionSecure{
				Token: common.InlineSecureValue{Name: "existing-token"},
			},
		}
		mockTokenConn := connection.NewMockTokenConnection(t)
		mockTokenConn.EXPECT().TokenCreationTime(ctx).Return(time.Time{}, errors.New("parse error"))

		needsGen, expired, err := shouldGenerateToken(ctx, conn, mockTokenConn, resyncInterval)

		assert.Error(t, err)
		assert.False(t, needsGen)
		assert.False(t, expired)
	})

	t.Run("error getting expiration - should return error", func(t *testing.T) {
		conn := &provisioning.Connection{
			Secure: provisioning.ConnectionSecure{
				Token: common.InlineSecureValue{Name: "existing-token"},
			},
		}
		mockTokenConn := connection.NewMockTokenConnection(t)
		mockTokenConn.EXPECT().TokenCreationTime(ctx).Return(time.Now().Add(-15*time.Second), nil)
		mockTokenConn.EXPECT().TokenExpiration(ctx).Return(time.Time{}, errors.New("parse error"))

		needsGen, expired, err := shouldGenerateToken(ctx, conn, mockTokenConn, resyncInterval)

		assert.Error(t, err)
		assert.False(t, needsGen)
		assert.False(t, expired)
	})
}

func TestReconcileConnectionToken(t *testing.T) {
	ctx := context.Background()
	resyncInterval := 2 * time.Minute

	t.Run("not a token connection - should return no patches", func(t *testing.T) {
		conn := &provisioning.Connection{
			ObjectMeta: metav1.ObjectMeta{
				Name:       "test-conn",
				Generation: 1,
			},
		}
		mockConn := connection.NewMockConnection(t)

		patchOps, err := ReconcileConnectionToken(ctx, conn, mockConn, resyncInterval)

		assert.NoError(t, err)
		assert.Empty(t, patchOps)
	})

	t.Run("token doesn't need generation - should return no patches", func(t *testing.T) {
		conn := &provisioning.Connection{
			ObjectMeta: metav1.ObjectMeta{
				Name:       "test-conn",
				Generation: 1,
			},
			Secure: provisioning.ConnectionSecure{
				Token: common.InlineSecureValue{Name: "existing-token"},
			},
		}
		mockConn := connection.NewMockConnection(t)
		mockTokenConn := connection.NewMockTokenConnection(t)
		mockTokenConn.EXPECT().TokenCreationTime(ctx).Return(time.Now().Add(-5*time.Second), nil)
		mockWrapper := &mockTokenConnectionWrapper{
			Connection:      mockConn,
			TokenConnection: mockTokenConn,
		}

		patchOps, err := ReconcileConnectionToken(ctx, conn, mockWrapper, resyncInterval)

		assert.NoError(t, err)
		assert.Empty(t, patchOps)
	})

	t.Run("token generation succeeds - should return patch ops", func(t *testing.T) {
		conn := &provisioning.Connection{
			ObjectMeta: metav1.ObjectMeta{
				Name:       "test-conn",
				Generation: 1,
			},
			Secure: provisioning.ConnectionSecure{
				Token: common.InlineSecureValue{}, // Missing token
			},
		}
		mockConn := connection.NewMockConnection(t)
		mockTokenConn := connection.NewMockTokenConnection(t)
		mockTokenConn.EXPECT().GenerateConnectionToken(ctx).Return(common.RawSecureValue("new-token"), nil)
		mockWrapper := &mockTokenConnectionWrapper{
			Connection:      mockConn,
			TokenConnection: mockTokenConn,
		}

		patchOps, err := ReconcileConnectionToken(ctx, conn, mockWrapper, resyncInterval)

		assert.NoError(t, err)
		require.Len(t, patchOps, 1)
		assert.Equal(t, "replace", patchOps[0]["op"])
		assert.Equal(t, "/secure/token", patchOps[0]["path"])
		// Verify token was set on connection
		assert.False(t, conn.Secure.Token.IsZero())
	})

	t.Run("token generation fails, token not expired - should return no error", func(t *testing.T) {
		conn := &provisioning.Connection{
			ObjectMeta: metav1.ObjectMeta{
				Name:       "test-conn",
				Generation: 1,
			},
			Secure: provisioning.ConnectionSecure{
				Token: common.InlineSecureValue{Name: "existing-token"},
			},
		}
		mockConn := connection.NewMockConnection(t)
		mockTokenConn := connection.NewMockTokenConnection(t)
		mockTokenConn.EXPECT().TokenCreationTime(ctx).Return(time.Now().Add(-15*time.Second), nil)
		// Token expires in 2 minutes - needs refresh but not expired
		mockTokenConn.EXPECT().TokenExpiration(ctx).Return(time.Now().Add(2*time.Minute), nil)
		mockTokenConn.EXPECT().GenerateConnectionToken(ctx).Return(common.RawSecureValue(""), errors.New("generation failed"))
		mockWrapper := &mockTokenConnectionWrapper{
			Connection:      mockConn,
			TokenConnection: mockTokenConn,
		}

		patchOps, err := ReconcileConnectionToken(ctx, conn, mockWrapper, resyncInterval)

		// Should not return error - will retry later
		assert.NoError(t, err)
		assert.Empty(t, patchOps)
	})

	t.Run("token generation fails, token expired - should return error with health status", func(t *testing.T) {
		conn := &provisioning.Connection{
			ObjectMeta: metav1.ObjectMeta{
				Name:       "test-conn",
				Generation: 1,
			},
			Secure: provisioning.ConnectionSecure{
				Token: common.InlineSecureValue{Name: "existing-token"},
			},
		}
		mockConn := connection.NewMockConnection(t)
		mockTokenConn := connection.NewMockTokenConnection(t)
		mockTokenConn.EXPECT().TokenCreationTime(ctx).Return(time.Now().Add(-15*time.Second), nil)
		mockTokenConn.EXPECT().TokenExpiration(ctx).Return(time.Now().Add(-1*time.Minute), nil)
		mockTokenConn.EXPECT().GenerateConnectionToken(ctx).Return(common.RawSecureValue(""), errors.New("generation failed"))
		mockWrapper := &mockTokenConnectionWrapper{
			Connection:      mockConn,
			TokenConnection: mockTokenConn,
		}

		patchOps, err := ReconcileConnectionToken(ctx, conn, mockWrapper, resyncInterval)

		// Should return error when token is expired
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "token expired")

		// Should include health status patch
		assert.NotEmpty(t, patchOps)
		require.Len(t, patchOps, 1)
		assert.Equal(t, "replace", patchOps[0]["op"])
		assert.Equal(t, "/status/health", patchOps[0]["path"])

		// Verify health status indicates failure
		healthStatus, ok := patchOps[0]["value"].(provisioning.HealthStatus)
		require.True(t, ok)
		assert.False(t, healthStatus.Healthy)
		assert.Equal(t, provisioning.HealthFailureHealth, healthStatus.Error)
		assert.Contains(t, healthStatus.Message[0], "Failed to generate connection token")
	})

	t.Run("error checking token, spec unchanged - should return no error", func(t *testing.T) {
		conn := &provisioning.Connection{
			ObjectMeta: metav1.ObjectMeta{
				Name:       "test-conn",
				Generation: 1,
			},
			Status: provisioning.ConnectionStatus{
				ObservedGeneration: 1, // Same as Generation
			},
			Secure: provisioning.ConnectionSecure{
				Token: common.InlineSecureValue{Name: "existing-token"},
			},
		}
		mockConn := connection.NewMockConnection(t)
		mockTokenConn := connection.NewMockTokenConnection(t)
		mockTokenConn.EXPECT().TokenCreationTime(ctx).Return(time.Time{}, errors.New("parse error"))
		mockWrapper := &mockTokenConnectionWrapper{
			Connection:      mockConn,
			TokenConnection: mockTokenConn,
		}

		patchOps, err := ReconcileConnectionToken(ctx, conn, mockWrapper, resyncInterval)

		// Should not error when spec unchanged
		assert.NoError(t, err)
		assert.Empty(t, patchOps)
	})

	t.Run("error checking token, spec changed - should return error", func(t *testing.T) {
		conn := &provisioning.Connection{
			ObjectMeta: metav1.ObjectMeta{
				Name:       "test-conn",
				Generation: 2,
			},
			Status: provisioning.ConnectionStatus{
				ObservedGeneration: 1, // Different from Generation
			},
			Secure: provisioning.ConnectionSecure{
				Token: common.InlineSecureValue{Name: "existing-token"},
			},
		}
		mockConn := connection.NewMockConnection(t)
		mockTokenConn := connection.NewMockTokenConnection(t)
		mockTokenConn.EXPECT().TokenCreationTime(ctx).Return(time.Time{}, errors.New("parse error"))
		mockWrapper := &mockTokenConnectionWrapper{
			Connection:      mockConn,
			TokenConnection: mockTokenConn,
		}

		patchOps, err := ReconcileConnectionToken(ctx, conn, mockWrapper, resyncInterval)

		// Should error when spec changed
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "determine if token needs generation")
		assert.Empty(t, patchOps)
	})
}

func TestBuildReadyCondition(t *testing.T) {
	t.Run("healthy with no token error", func(t *testing.T) {
		healthStatus := provisioning.HealthStatus{Healthy: true}
		condition := buildReadyCondition(healthStatus, nil)

		assert.Equal(t, provisioning.ConditionTypeReady, condition.Type)
		assert.Equal(t, metav1.ConditionTrue, condition.Status)
		assert.Equal(t, provisioning.ReasonAvailable, condition.Reason)
		assert.Equal(t, "Connection is available", condition.Message)
	})

	t.Run("unhealthy with no token error", func(t *testing.T) {
		healthStatus := provisioning.HealthStatus{Healthy: false}
		condition := buildReadyCondition(healthStatus, nil)

		assert.Equal(t, provisioning.ConditionTypeReady, condition.Type)
		assert.Equal(t, metav1.ConditionFalse, condition.Status)
		assert.Equal(t, provisioning.ReasonInvalidSpec, condition.Reason)
		assert.Equal(t, "Spec is invalid", condition.Message)
	})

}