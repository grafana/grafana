package controller

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
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

	t.Run("not a token connection - should continue", func(t *testing.T) {
		conn := &provisioning.Connection{
			ObjectMeta: metav1.ObjectMeta{
				Name:       "test-conn",
				Generation: 1,
			},
		}
		mockConn := connection.NewMockConnection(t)

		result := ReconcileConnectionToken(ctx, conn, mockConn, resyncInterval)

		assert.True(t, result.ShouldContinue)
		assert.Nil(t, result.Condition)
		assert.Empty(t, result.PatchOperations)
		assert.Empty(t, result.Token)
	})

	t.Run("token doesn't need generation - should continue", func(t *testing.T) {
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

		result := ReconcileConnectionToken(ctx, conn, mockWrapper, resyncInterval)

		assert.True(t, result.ShouldContinue)
		assert.Nil(t, result.Condition)
		assert.Empty(t, result.PatchOperations)
		assert.Empty(t, result.Token)
	})

	t.Run("token generation succeeds - should return patches and token", func(t *testing.T) {
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
		mockTokenConn.EXPECT().GenerateConnectionToken(ctx).Return("new-token", nil)
		mockWrapper := &mockTokenConnectionWrapper{
			Connection:      mockConn,
			TokenConnection: mockTokenConn,
		}

		result := ReconcileConnectionToken(ctx, conn, mockWrapper, resyncInterval)

		assert.True(t, result.ShouldContinue)
		assert.Nil(t, result.Condition)
		assert.Len(t, result.PatchOperations, 1)
		assert.Equal(t, "new-token", result.Token)
		assert.Equal(t, "replace", result.PatchOperations[0]["op"])
		assert.Equal(t, "/secure/token", result.PatchOperations[0]["path"])
	})

	t.Run("token generation fails, token not expired - should continue with condition", func(t *testing.T) {
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
		mockTokenConn.EXPECT().GenerateConnectionToken(ctx).Return("", errors.New("generation failed"))
		mockWrapper := &mockTokenConnectionWrapper{
			Connection:      mockConn,
			TokenConnection: mockTokenConn,
		}

		result := ReconcileConnectionToken(ctx, conn, mockWrapper, resyncInterval)

		assert.True(t, result.ShouldContinue) // Can still try with existing token
		assert.NotNil(t, result.Condition)
		assert.Equal(t, provisioning.ConditionTypeReady, result.Condition.Type)
		assert.Equal(t, metav1.ConditionFalse, result.Condition.Status)
		assert.Equal(t, provisioning.ReasonTokenGenerationFailed, result.Condition.Reason)
		assert.Contains(t, result.Condition.Message, "Failed to refresh token")
		assert.Empty(t, result.PatchOperations)
		assert.Empty(t, result.Token)
	})

	t.Run("token generation fails, token expired - should not continue", func(t *testing.T) {
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
		mockTokenConn.EXPECT().GenerateConnectionToken(ctx).Return("", errors.New("generation failed"))
		mockWrapper := &mockTokenConnectionWrapper{
			Connection:      mockConn,
			TokenConnection: mockTokenConn,
		}

		result := ReconcileConnectionToken(ctx, conn, mockWrapper, resyncInterval)

		assert.False(t, result.ShouldContinue) // Can't proceed with expired token
		assert.NotNil(t, result.Condition)
		assert.Equal(t, provisioning.ConditionTypeReady, result.Condition.Type)
		assert.Equal(t, metav1.ConditionFalse, result.Condition.Status)
		assert.Equal(t, provisioning.ReasonTokenGenerationFailed, result.Condition.Reason)
		assert.Contains(t, result.Condition.Message, "Failed to generate connection token")
		assert.Empty(t, result.PatchOperations)
		assert.Empty(t, result.Token)
	})

	t.Run("error checking if token needs generation - should continue", func(t *testing.T) {
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
		mockTokenConn.EXPECT().TokenCreationTime(ctx).Return(time.Time{}, errors.New("parse error"))
		mockWrapper := &mockTokenConnectionWrapper{
			Connection:      mockConn,
			TokenConnection: mockTokenConn,
		}

		result := ReconcileConnectionToken(ctx, conn, mockWrapper, resyncInterval)

		assert.True(t, result.ShouldContinue) // Let health check decide
		assert.Nil(t, result.Condition)       // Health check will set condition
		assert.Empty(t, result.PatchOperations)
		assert.Empty(t, result.Token)
	})
}

func TestBuildReadyCondition(t *testing.T) {
	t.Run("healthy condition", func(t *testing.T) {
		condition := buildReadyCondition(true, provisioning.ReasonAvailable, "Connection is healthy")

		assert.Equal(t, provisioning.ConditionTypeReady, condition.Type)
		assert.Equal(t, metav1.ConditionTrue, condition.Status)
		assert.Equal(t, provisioning.ReasonAvailable, condition.Reason)
		assert.Equal(t, "Connection is healthy", condition.Message)
	})

	t.Run("unhealthy condition", func(t *testing.T) {
		condition := buildReadyCondition(false, provisioning.ReasonTokenGenerationFailed, "Token generation failed")

		assert.Equal(t, provisioning.ConditionTypeReady, condition.Type)
		assert.Equal(t, metav1.ConditionFalse, condition.Status)
		assert.Equal(t, provisioning.ReasonTokenGenerationFailed, condition.Reason)
		assert.Equal(t, "Token generation failed", condition.Message)
	})
}
