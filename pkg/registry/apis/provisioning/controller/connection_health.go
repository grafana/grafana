package controller

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/utils"
)

const (
	// connectionRecentHealthyDuration defines how recent a health check must be to be considered "recent" when healthy
	connectionRecentHealthyDuration = 5 * time.Minute
	// connectionRecentUnhealthyDuration defines how recent a health check must be to be considered "recent" when unhealthy
	connectionRecentUnhealthyDuration = 1 * time.Minute
)

// ConnectionHealthCheckerInterface defines the interface for connection health checking operations
//
//go:generate mockery --name=ConnectionHealthCheckerInterface --structname=MockConnectionHealthChecker --inpackage --filename connection_health_mock.go --with-expecter
type ConnectionHealthCheckerInterface interface {
	ShouldCheckHealth(conn *provisioning.Connection) bool
	RefreshHealthWithPatchOps(ctx context.Context, conn *provisioning.Connection) (*provisioning.TestResults, provisioning.HealthStatus, []map[string]interface{}, error)
}

//go:generate mockery --name=ConnectionTester --structname=MockConnectionTester --inpackage --filename connection_tester_mock.go --with-expecter
type ConnectionTester interface {
	TestConnection(ctx context.Context, conn *provisioning.Connection) (*provisioning.TestResults, error)
}

// ConnectionHealthChecker provides unified health checking for connections
type ConnectionHealthChecker struct {
	healthMetricsRecorder HealthMetricsRecorder
	tester                ConnectionTester
}

var (
	_ ConnectionHealthCheckerInterface = (*ConnectionHealthChecker)(nil)
)

// NewConnectionHealthChecker creates a new connection health checker
func NewConnectionHealthChecker(
	tester ConnectionTester,
	healthMetricsRecorder HealthMetricsRecorder,
) *ConnectionHealthChecker {
	return &ConnectionHealthChecker{
		tester:                tester,
		healthMetricsRecorder: healthMetricsRecorder,
	}
}

// ShouldCheckHealth determines if a connection health check should be performed
func (hc *ConnectionHealthChecker) ShouldCheckHealth(conn *provisioning.Connection) bool {
	// If the connection has been updated, run the health check
	if conn.Generation != conn.Status.ObservedGeneration {
		return true
	}

	// Check general timing for health checks
	return !hc.hasRecentHealthCheck(conn.Status.Health)
}

// hasRecentHealthCheck checks if a health check was performed recently (for timing purposes)
func (hc *ConnectionHealthChecker) hasRecentHealthCheck(healthStatus provisioning.HealthStatus) bool {
	if healthStatus.Checked == 0 {
		return false // Never checked
	}

	age := time.Since(time.UnixMilli(healthStatus.Checked))
	if healthStatus.Healthy {
		return age <= connectionRecentHealthyDuration
	}
	return age <= connectionRecentUnhealthyDuration // Recent if checked within 1 minute when unhealthy
}

// hasHealthStatusChanged checks if the health status has meaningfully changed
func (hc *ConnectionHealthChecker) hasHealthStatusChanged(old, new provisioning.HealthStatus) bool {
	if old.Healthy != new.Healthy {
		return true
	}

	if len(old.Message) != len(new.Message) {
		return true
	}

	recent := connectionRecentUnhealthyDuration
	if new.Healthy {
		recent = connectionRecentHealthyDuration
	}
	if time.UnixMilli(new.Checked).Sub(time.UnixMilli(old.Checked)) > recent {
		return true
	}

	for i, oldMsg := range old.Message {
		if i >= len(new.Message) || oldMsg != new.Message[i] {
			return true
		}
	}

	return false
}

// RefreshHealthWithPatchOps performs a health check on an existing connection
// and returns the test results, health status, and patch operations to apply.
// This method does NOT apply the patch itself, allowing the caller to batch
// multiple status updates together to avoid race conditions.
func (hc *ConnectionHealthChecker) RefreshHealthWithPatchOps(ctx context.Context, conn *provisioning.Connection) (*provisioning.TestResults, provisioning.HealthStatus, []map[string]interface{}, error) {
	// Use health checker to perform comprehensive health check with existing status
	testResults, newHealthStatus, err := hc.refreshHealth(ctx, conn, conn.Status.Health)
	if err != nil {
		return nil, provisioning.HealthStatus{}, nil, fmt.Errorf("health check failed: %w", err)
	}

	var patchOps []map[string]interface{}

	// Only return patch operation if health status actually changed
	if hc.hasHealthStatusChanged(conn.Status.Health, newHealthStatus) {
		patchOps = append(patchOps, map[string]interface{}{
			"op":    "replace",
			"path":  "/status/health",
			"value": newHealthStatus,
		})
	}

	return testResults, newHealthStatus, patchOps, nil
}

// refreshHealth performs a comprehensive health check
// Returns test results, health status, and any error
func (hc *ConnectionHealthChecker) refreshHealth(ctx context.Context, conn *provisioning.Connection, existingStatus provisioning.HealthStatus) (*provisioning.TestResults, provisioning.HealthStatus, error) {
	logger := logging.FromContext(ctx).With("connection", conn.GetName(), "namespace", conn.GetNamespace())
	start := time.Now()
	outcome := utils.SuccessOutcome
	defer func() {
		hc.healthMetricsRecorder.RecordHealthCheck("connection", outcome, time.Since(start).Seconds())
	}()

	res, err := hc.tester.TestConnection(ctx, conn)
	if err != nil {
		outcome = utils.ErrorOutcome
		logger.Error("failed to test connection", "error", err)
		return nil, existingStatus, fmt.Errorf("failed to test connection: %w", err)
	}

	if !res.Success {
		// Build error messages
		var errorMsgs []string
		for _, testErr := range res.Errors {
			if testErr.Detail != "" {
				errorMsgs = append(errorMsgs, testErr.Detail)
			}
		}

		healthStatus := provisioning.HealthStatus{
			Healthy: false,
			Error:   provisioning.HealthFailureHealth,
			Checked: time.Now().UnixMilli(),
			Message: errorMsgs,
		}

		return res, healthStatus, nil
	}

	// Health check succeeded
	now := time.Now()
	healthStatus := provisioning.HealthStatus{
		Healthy: true,
		Checked: now.UnixMilli(),
	}

	// If the existing status is already healthy with no error messages and
	// the last check was recent (within 30 seconds), preserve the existing timestamp
	// to avoid unnecessary updates
	if existingStatus.Healthy && existingStatus.Error == "" && len(existingStatus.Message) == 0 {
		lastCheckedTime := time.UnixMilli(existingStatus.Checked)
		if now.Sub(lastCheckedTime) < 30*time.Second {
			healthStatus.Checked = existingStatus.Checked
		}
	}

	return res, healthStatus, nil
}
