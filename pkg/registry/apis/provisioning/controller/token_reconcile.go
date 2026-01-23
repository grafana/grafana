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

// buildTokenCondition creates a TokenReady condition with the specified status, reason, and message.
func buildTokenCondition(status metav1.ConditionStatus, reason string, message string) metav1.Condition {
	return metav1.Condition{
		Type:    provisioning.ConditionTypeToken,
		Status:  status,
		Reason:  reason,
		Message: message,
	}
}

// buildTokenConditionFromError creates a TokenReady condition from an error.
// This is used when token operations fail (parsing, validation, generation).
func buildTokenConditionFromError(err error, reason string) metav1.Condition {
	return buildTokenCondition(
		metav1.ConditionFalse,
		reason,
		err.Error(),
	)
}

// buildTokenValidCondition creates a TokenReady condition for a valid token.
func buildTokenValidCondition(expiration time.Time) metav1.Condition {
	return buildTokenCondition(
		metav1.ConditionTrue,
		provisioning.ReasonTokenValid,
		fmt.Sprintf("Token valid until %s", expiration.Format(time.RFC3339)),
	)
}

// buildTokenRefreshedCondition creates a TokenReady condition for a successfully refreshed token.
func buildTokenRefreshedCondition() metav1.Condition {
	return buildTokenCondition(
		metav1.ConditionTrue,
		provisioning.ReasonTokenRefreshed,
		"Token was recently refreshed",
	)
}

// buildTokenExpiringCondition creates a TokenReady condition for a token that is expiring soon.
func buildTokenExpiringCondition(expiration time.Time) metav1.Condition {
	return buildTokenCondition(
		metav1.ConditionTrue,
		provisioning.ReasonTokenExpiring,
		fmt.Sprintf("Token expires at %s", expiration.Format(time.RFC3339)),
	)
}

// buildTokenExpiredCondition creates a TokenReady condition for an expired token.
func buildTokenExpiredCondition(expiration time.Time) metav1.Condition {
	return buildTokenCondition(
		metav1.ConditionFalse,
		provisioning.ReasonTokenExpired,
		fmt.Sprintf("Token expired at %s", expiration.Format(time.RFC3339)),
	)
}

// checkTokenStatus checks the token status and returns a condition and whether to refresh.
// Unlike shouldRefreshToken, this method does not return errors - instead it creates
// conditions that reflect token errors, allowing reconciliation to continue.
//
// Returns:
//   - metav1.Condition: The token condition to apply
//   - bool: Whether to attempt token refresh
func (cc *ConnectionController) checkTokenStatus(ctx context.Context, c connection.TokenConnection, conn *provisioning.Connection) (metav1.Condition, bool) {
	logger := logging.FromContext(ctx)

	// Try to get token creation time
	issuingTime, err := c.TokenCreationTime(ctx)
	if err != nil {
		logger.Warn("failed to get token creation time", "error", err)
		return buildTokenConditionFromError(err, provisioning.ReasonTokenInvalid), false
	}

	// Check if token was just created (within 10 seconds)
	if tokenRecentlyCreated(issuingTime) {
		return buildTokenRefreshedCondition(), false
	}

	// Try to get token expiration
	expiration, err := c.TokenExpiration(ctx)
	if err != nil {
		logger.Warn("failed to get token expiration", "error", err)
		return buildTokenConditionFromError(err, provisioning.ReasonTokenInvalid), false
	}

	// Check if token is expired
	if expiration.Before(time.Now()) {
		return buildTokenExpiredCondition(expiration), true
	}

	// Check if token needs refresh (within buffer period)
	needsRefresh := shouldRefreshBeforeExpiration(expiration, cc.resyncInterval)
	if needsRefresh {
		return buildTokenExpiringCondition(expiration), true
	}

	// Token is valid and not expiring soon
	return buildTokenValidCondition(expiration), false
}
