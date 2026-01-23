package controller

import (
	"context"
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
)

// TokenReconcileResult contains the result of token reconciliation
type TokenReconcileResult struct {
	// ShouldContinue indicates whether reconciliation should proceed to health checks.
	// False means token issues prevent meaningful health checks (e.g., expired token with failed refresh).
	ShouldContinue bool

	// PatchOperations are JSON patch operations to update the connection (e.g., new token).
	PatchOperations []map[string]interface{}

	// Condition is the Ready condition reflecting token state, or nil if no condition update needed.
	Condition *metav1.Condition

	// Token is the new token value to use for health checks (if generated).
	Token string
}

// ReconcileConnectionToken handles token generation and refresh for a connection.
// It determines if the connection is ready to proceed with health checks based on token state.
//
// Returns:
//   - TokenReconcileResult with continuation flag, patch operations, and condition
func ReconcileConnectionToken(
	ctx context.Context,
	conn *provisioning.Connection,
	c connection.Connection,
	resyncInterval time.Duration,
) TokenReconcileResult {
	logger := logging.FromContext(ctx)

	// Check if connection supports token generation
	tokenConn, ok := c.(connection.TokenConnection)
	if !ok {
		// Not a token connection, nothing to do
		return TokenReconcileResult{
			ShouldContinue: true,
		}
	}

	// Check if token needs to be generated or refreshed
	needsGeneration, tokenExpired, err := shouldGenerateToken(ctx, conn, tokenConn, resyncInterval)
	if err != nil {
		logger.Warn("failed to check if token needs generation", "error", err)
		// Can't determine token state - let health check decide
		return TokenReconcileResult{
			ShouldContinue: true,
			Condition:      nil, // Health check will set the condition
		}
	}

	if !needsGeneration {
		// Token is fine, continue with health checks
		return TokenReconcileResult{
			ShouldContinue: true,
		}
	}

	// Token needs generation - attempt to generate
	logger.Info("generating connection token")
	token, err := tokenConn.GenerateConnectionToken(ctx)
	if err != nil {
		logger.Error("failed to generate connection token", "error", err)

		// Generation failed - check if existing token is expired
		if tokenExpired {
			// Can't proceed with expired token and failed generation
			condition := buildReadyCondition(false, provisioning.ReasonTokenGenerationFailed,
				fmt.Sprintf("Failed to generate connection token: %v", err))
			return TokenReconcileResult{
				ShouldContinue: false,
				Condition:      &condition,
			}
		}

		// Token not expired yet - continue with existing token, but surface the error
		condition := buildReadyCondition(false, provisioning.ReasonTokenGenerationFailed,
			fmt.Sprintf("Failed to refresh token: %v", err))
		return TokenReconcileResult{
			ShouldContinue: true, // Can still try health check with existing token
			Condition:      &condition,
		}
	}

	// Token generated successfully
	logger.Info("successfully generated new connection token")
	patchOps := []map[string]interface{}{
		{
			"op":   "replace",
			"path": "/secure/token",
			"value": map[string]string{
				"create": string(token),
			},
		},
	}

	return TokenReconcileResult{
		ShouldContinue:  true,
		PatchOperations: patchOps,
		Token:           string(token),
	}
}

// shouldGenerateToken determines if a token needs to be generated or refreshed.
// Returns (needsGeneration, isExpired, error).
func shouldGenerateToken(
	ctx context.Context,
	conn *provisioning.Connection,
	tokenConn connection.TokenConnection,
	resyncInterval time.Duration,
) (bool, bool, error) {
	// If no token exists, always generate
	if conn.Secure.Token.IsZero() {
		return true, false, nil
	}

	// Check token creation time
	issuingTime, err := tokenConn.TokenCreationTime(ctx)
	if err != nil {
		// Can't parse existing token
		return false, false, err
	}

	// If token was just created, don't refresh yet
	if tokenRecentlyCreated(issuingTime) {
		return false, false, nil
	}

	// Check token expiration
	expiration, err := tokenConn.TokenExpiration(ctx)
	if err != nil {
		// Can't determine expiration
		return false, false, err
	}

	// Check if expired
	isExpired := expiration.Before(time.Now())
	if isExpired {
		return true, true, nil
	}

	// Check if needs refresh soon
	needsRefresh := shouldRefreshBeforeExpiration(expiration, resyncInterval)
	return needsRefresh, false, nil
}

// buildReadyCondition creates a Ready condition with the specified status and reason.
func buildReadyCondition(healthy bool, reason string, message string) metav1.Condition {
	status := metav1.ConditionTrue
	if !healthy {
		status = metav1.ConditionFalse
	}

	return metav1.Condition{
		Type:    provisioning.ConditionTypeReady,
		Status:  status,
		Reason:  reason,
		Message: message,
	}
}
