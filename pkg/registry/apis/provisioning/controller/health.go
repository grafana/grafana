package controller

import (
	"context"
	"fmt"
	"time"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

// StatusPatcher defines the interface for updating repository status
//
//go:generate mockery --name=StatusPatcher
type StatusPatcher interface {
	Patch(ctx context.Context, repo *provisioning.Repository, patchOperations ...map[string]interface{}) error
}

// HealthChecker provides unified health checking for repositories
type HealthChecker struct {
	tester        RepositoryTester
	statusPatcher StatusPatcher
}

// RepositoryTester defines the interface for testing repository connectivity
//
//go:generate mockery --name=RepositoryTester
type RepositoryTester interface {
	TestRepository(ctx context.Context, repo repository.Repository) (*provisioning.TestResults, error)
}

// NewHealthChecker creates a new health checker
func NewHealthChecker(tester RepositoryTester, statusPatcher StatusPatcher) *HealthChecker {
	return &HealthChecker{
		tester:        tester,
		statusPatcher: statusPatcher,
	}
}

// ShouldCheckHealth determines if a repository health check should be performed
func (hc *HealthChecker) ShouldCheckHealth(repo *provisioning.Repository) bool {
	// If the repository has been updated, run the health check
	if repo.Generation != repo.Status.ObservedGeneration {
		return true
	}

	// If the repository has a hook error, don't run the health check
	if repo.Status.Health.Error == provisioning.HealthFailureHook {
		return false
	}

	// Check general timing for health checks
	return !hc.hasRecentHealthCheck(repo.Status.Health)
}

// hasRecentHealthCheck checks if a health check was performed recently (for timing purposes)
func (hc *HealthChecker) hasRecentHealthCheck(healthStatus provisioning.HealthStatus) bool {
	if healthStatus.Checked == 0 {
		return false // Never checked
	}

	age := time.Since(time.UnixMilli(healthStatus.Checked))
	if healthStatus.Healthy {
		return age <= time.Minute*5 // Recent if checked within 5 minutes when healthy
	}
	return age <= time.Minute // Recent if checked within 1 minute when unhealthy
}

// HasRecentFailure checks if there's a recent failure of a specific type
func (hc *HealthChecker) HasRecentFailure(healthStatus provisioning.HealthStatus, failureType provisioning.HealthFailureType) bool {
	if healthStatus.Checked == 0 || healthStatus.Healthy || healthStatus.Error != failureType {
		return false // No failure of this type
	}

	age := time.Since(time.UnixMilli(healthStatus.Checked))
	return age <= time.Minute // Recent if within 1 minute
}

// RecordFailureAndUpdate records a failure and updates the repository status
func (hc *HealthChecker) RecordFailure(ctx context.Context, failureType provisioning.HealthFailureType, err error, repo *provisioning.Repository) error {
	// Create the health status with the failure
	healthStatus := hc.recordFailure(failureType, err)

	// Create patch operation
	patchOp := map[string]interface{}{
		"op":    "replace",
		"path":  "/status/health",
		"value": healthStatus,
	}

	// Apply the patch
	return hc.statusPatcher.Patch(ctx, repo, patchOp)
}

// recordFailure creates a health status with a specific failure
func (hc *HealthChecker) recordFailure(failureType provisioning.HealthFailureType, err error) provisioning.HealthStatus {
	return provisioning.HealthStatus{
		Healthy: false,
		Error:   failureType,
		Checked: time.Now().UnixMilli(),
		Message: []string{err.Error()},
	}
}

// hasHealthStatusChanged checks if the health status has meaningfully changed
func (hc *HealthChecker) hasHealthStatusChanged(old, new provisioning.HealthStatus) bool {
	if old.Healthy != new.Healthy {
		return true
	}

	if len(old.Message) != len(new.Message) {
		return true
	}

	if old.Checked != new.Checked {
		return true
	}

	for i, oldMsg := range old.Message {
		if i >= len(new.Message) || oldMsg != new.Message[i] {
			return true
		}
	}

	return false
}

// RefreshHealth performs a health check on an existing repository,
// updates its status if needed, and returns the test results
func (hc *HealthChecker) RefreshHealth(ctx context.Context, repo repository.Repository) (*provisioning.TestResults, provisioning.HealthStatus, error) {
	cfg := repo.Config()

	// Use health checker to perform comprehensive health check with existing status
	testResults, newHealthStatus, err := hc.refreshHealth(ctx, repo, cfg.Status.Health)
	if err != nil {
		return nil, provisioning.HealthStatus{}, fmt.Errorf("health check failed: %w", err)
	}

	// Only update if health status actually changed
	if hc.hasHealthStatusChanged(cfg.Status.Health, newHealthStatus) {
		patchOp := map[string]interface{}{
			"op":    "replace",
			"path":  "/status/health",
			"value": newHealthStatus,
		}

		if err := hc.statusPatcher.Patch(ctx, cfg, patchOp); err != nil {
			return testResults, newHealthStatus, fmt.Errorf("update health status: %w", err)
		}
	}

	return testResults, newHealthStatus, nil
}

// RefreshTimestamp updates the health status timestamp without changing other fields
func (hc *HealthChecker) RefreshTimestamp(ctx context.Context, repo *provisioning.Repository) error {
	// Update the timestamp on the existing health status
	healthStatus := repo.Status.Health
	healthStatus.Checked = time.Now().UnixMilli()

	// Create patch operation
	patchOp := map[string]interface{}{
		"op":    "replace",
		"path":  "/status/health",
		"value": healthStatus,
	}

	// Apply the patch
	return hc.statusPatcher.Patch(ctx, repo, patchOp)
}

// refreshHealth performs a comprehensive health check
// Returns test results, health status, and any error
func (hc *HealthChecker) refreshHealth(ctx context.Context, repo repository.Repository, existingStatus provisioning.HealthStatus) (*provisioning.TestResults, provisioning.HealthStatus, error) {
	res, err := hc.tester.TestRepository(ctx, repo)
	if err != nil {
		return nil, existingStatus, fmt.Errorf("failed to test repository: %w", err)
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
