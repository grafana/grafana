package controller

import (
	"context"
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// ReconcileConnectionToken handles token generation and refresh for a connection.
// It determines if the connection is ready to proceed with health checks based on token state.
// When the token is expired and generation fails, it builds all necessary patch operations to mark the connection as disconnected.
// Returns:
//   - Patch operations to update the connection status and ready condition
//   - Error if the token generation fails
func ReconcileConnectionToken(
	ctx context.Context,
	conn *provisioning.Connection,
	c connection.Connection,
	resyncInterval time.Duration,
) (patchOps []map[string]interface{}, err error) {
	logger := logging.FromContext(ctx)

	// Check if connection supports token generation
	tokenConn, ok := c.(connection.TokenConnection)
	if !ok {
		// Not a token connection, nothing to do
		return nil, nil
	}

	// Check if token needs to be generated or refreshed
	needsGeneration, isTokenExpired, err := shouldGenerateToken(ctx, conn, tokenConn, resyncInterval)
	if err != nil {
		if conn.Generation == conn.Status.ObservedGeneration {
			logger.Error("token reconciliation failed, but spec did not change; ignoring until spec changes", "error", err)
			return nil, nil
		}

		// In this case we must necessarily fail, as we can't determine if the token needs generation
		// and therefore validate if spec changed.
		return nil, fmt.Errorf("determine if token needs generation: %w", err)
	}

	if !needsGeneration {
		return nil, nil
	}

	// Token needs generation - attempt to generate
	logger.Info("generating connection token")
	token, err := tokenConn.GenerateConnectionToken(ctx)
	if err != nil {
		if isTokenExpired {
			// Token is expired and generation failed - update health status to show failure
			logger.Error("failed to generate connection token with expired token", "error", err)

			healthStatus := provisioning.HealthStatus{
				Healthy: false,
				Error:   provisioning.HealthFailureHealth,
				Checked: time.Now().UnixMilli(),
				Message: []string{fmt.Sprintf("Failed to generate connection token: %v", err)},
			}

			patchOps = append(patchOps, map[string]interface{}{
				"op":    "replace",
				"path":  "/status/health",
				"value": healthStatus,
			})

			return patchOps, fmt.Errorf("token expired: %w", err)
		}

		logger.Error("failed to refresh token ahead of time but will try again later", "error", err)
		return nil, nil // Not an error, we will try again later
	}

	logger.Info("successfully generated new connection token")
	// TODO: Update or create if there was a previous one
	conn.Secure.Token = common.InlineSecureValue{Create: common.NewSecretValue(token.String())}
	patchOps = append(patchOps, map[string]interface{}{
		"op":   "replace",
		"path": "/secure/token",
		"value": map[string]string{
			"create": token.String(),
		},
	})

	return patchOps, nil
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
func buildReadyCondition(healthStatus provisioning.HealthStatus, tokenGenerationError error) metav1.Condition {
	status := metav1.ConditionTrue
	reason := provisioning.ReasonAvailable
	msg := "Connection is available"

	if !healthStatus.Healthy {
		status = metav1.ConditionFalse
		reason = provisioning.ReasonInvalidSpec
		msg = "Spec is invalid"
	}

	if tokenGenerationError != nil && reason != provisioning.ReasonInvalidSpec {
		reason = provisioning.ReasonTokenGenerationFailed
		msg = tokenGenerationError.Error()
	}

	return metav1.Condition{
		Type:    provisioning.ConditionTypeReady,
		Status:  status,
		Reason:  reason,
		Message: msg,
	}
}
