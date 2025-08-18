package controller

import (
	"context"
	"fmt"
	"strings"
	"time"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

// StatusPatcher defines the interface for updating repository status
type StatusPatcher interface {
	Patch(ctx context.Context, repo *provisioning.Repository, patchOperations ...map[string]interface{}) error
}

// HealthChecker provides unified health checking for repositories
type HealthChecker struct {
	tester        RepositoryTester
	statusPatcher StatusPatcher
}

// RepositoryTester defines the interface for testing repository connectivity
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

// FailureType represents different types of repository failures
type FailureType string

const (
	FailureTypeHook   FailureType = "Hook execution failed"
	FailureTypeSetup  FailureType = "Repository setup failed"
	FailureTypeHealth FailureType = "Repository test failed"
)

// RepositoryFailure represents a repository failure with context
type RepositoryFailure struct {
	Type    FailureType
	Message string
	Time    time.Time
}

// Error implements the error interface
func (rf *RepositoryFailure) Error() string {
	return fmt.Sprintf("%s: %s", rf.Type, rf.Message)
}

// NewRepositoryFailure creates a new repository failure
func NewRepositoryFailure(failureType FailureType, err error) *RepositoryFailure {
	return &RepositoryFailure{
		Type:    failureType,
		Message: err.Error(),
		Time:    time.Now(),
	}
}

// IsRecognizedFailure checks if an error is a recognized repository failure
func (hc *HealthChecker) IsRecognizedFailure(err error) bool {
	if err == nil {
		return false
	}

	if _, ok := err.(*RepositoryFailure); ok {
		return true
	}

	return false
}

// ParseExistingFailures extracts known failure types from existing health status
func (hc *HealthChecker) ParseExistingFailures(healthStatus provisioning.HealthStatus) []*RepositoryFailure {
	var failures []*RepositoryFailure

	for _, msg := range healthStatus.Message {
		for _, failureType := range []FailureType{FailureTypeHook, FailureTypeSetup, FailureTypeHealth} {
			prefix := string(failureType) + ":"
			if strings.HasPrefix(msg, prefix) {
				failures = append(failures, &RepositoryFailure{
					Type:    failureType,
					Message: strings.TrimSpace(msg[len(prefix):]),
					Time:    time.UnixMilli(healthStatus.Checked),
				})
				break
			}
		}
	}

	return failures
}

// ShouldRetryFailure checks if a failure should be retried based on staleness
func (hc *HealthChecker) ShouldRetryFailure(failure *RepositoryFailure) bool {
	age := time.Since(failure.Time)

	switch failure.Type {
	case FailureTypeHook:
		return age > time.Minute // Retry hooks after 1 minute
	case FailureTypeSetup:
		return age > time.Minute*2 // Retry setup after 2 minutes
	case FailureTypeHealth:
		return age > time.Minute // Retry health checks after 1 minute
	default:
		return age > time.Minute // Default retry interval
	}
}

// CheckRepositoryHealth performs a comprehensive health check
func (hc *HealthChecker) CheckRepositoryHealth(ctx context.Context, repo repository.Repository, existingStatus provisioning.HealthStatus) provisioning.HealthStatus {
	// Parse existing failures to preserve them
	existingFailures := hc.ParseExistingFailures(existingStatus)
	var preservedFailures []*RepositoryFailure

	// Keep failures that shouldn't be retried yet
	for _, failure := range existingFailures {
		if !hc.ShouldRetryFailure(failure) {
			preservedFailures = append(preservedFailures, failure)
		}
	}

	// Only run new health check if we don't have recent health failures
	var newHealthFailure *RepositoryFailure
	shouldRunHealthCheck := true
	for _, failure := range preservedFailures {
		if failure.Type == FailureTypeHealth {
			shouldRunHealthCheck = false
			break
		}
	}

	if shouldRunHealthCheck {
		if repo != nil {
			res, err := hc.tester.TestRepository(ctx, repo)
			if err != nil || (res != nil && !res.Success) {
				if err != nil {
					newHealthFailure = NewRepositoryFailure(FailureTypeHealth, err)
				} else {
					// Convert test result errors to failure
					var errorMsgs []string
					for _, testErr := range res.Errors {
						if testErr.Detail != "" {
							errorMsgs = append(errorMsgs, testErr.Detail)
						}
					}
					if len(errorMsgs) > 0 {
						newHealthFailure = NewRepositoryFailure(FailureTypeHealth, fmt.Errorf("%s", strings.Join(errorMsgs, "; ")))
					}
				}
			}
		}
	}

	// Combine all failures
	allFailures := preservedFailures
	if newHealthFailure != nil {
		allFailures = append(allFailures, newHealthFailure)
	}

	// Build health status
	healthy := len(allFailures) == 0
	messages := make([]string, 0, len(allFailures))
	for _, failure := range allFailures {
		messages = append(messages, failure.Error())
	}

	return provisioning.HealthStatus{
		Healthy: healthy,
		Checked: time.Now().UnixMilli(),
		Message: messages,
	}
}

// recordFailure creates a health status with a specific failure
func (hc *HealthChecker) recordFailure(failureType FailureType, err error, existingStatus provisioning.HealthStatus) provisioning.HealthStatus {
	// Parse existing failures
	existingFailures := hc.ParseExistingFailures(existingStatus)

	// Remove any existing failures of the same type (replace with new one)
	var preservedFailures []*RepositoryFailure
	for _, failure := range existingFailures {
		if failure.Type != failureType {
			preservedFailures = append(preservedFailures, failure)
		}
	}

	// Add the new failure
	newFailure := NewRepositoryFailure(failureType, err)
	allFailures := append(preservedFailures, newFailure)

	// Build health status
	messages := make([]string, 0, len(allFailures))
	for _, failure := range allFailures {
		messages = append(messages, failure.Error())
	}

	return provisioning.HealthStatus{
		Healthy: false,
		Checked: time.Now().UnixMilli(),
		Message: messages,
	}
}

// RecordFailureAndUpdate records a failure and updates the repository status
func (hc *HealthChecker) RecordFailure(ctx context.Context, failureType FailureType, err error, repo *provisioning.Repository) error {
	// Create the health status with the failure
	healthStatus := hc.recordFailure(failureType, err, repo.Status.Health)

	// Create patch operation
	patchOp := map[string]interface{}{
		"op":    "replace",
		"path":  "/status/health",
		"value": healthStatus,
	}

	// Apply the patch
	return hc.statusPatcher.Patch(ctx, repo, patchOp)
}

// HasRecentFailure checks if there's a recent failure of a specific type
func (hc *HealthChecker) HasRecentFailure(healthStatus provisioning.HealthStatus, failureType FailureType) bool {
	failures := hc.ParseExistingFailures(healthStatus)

	for _, failure := range failures {
		if failure.Type == failureType && !hc.ShouldRetryFailure(failure) {
			return true
		}
	}

	return false
}

// HasHealthStatusChanged checks if the health status has meaningfully changed
func (hc *HealthChecker) HasHealthStatusChanged(old, new provisioning.HealthStatus) bool {
	if old.Healthy != new.Healthy {
		return true
	}

	// Check if messages are different
	if len(old.Message) != len(new.Message) {
		return true
	}

	for i, oldMsg := range old.Message {
		if i >= len(new.Message) || oldMsg != new.Message[i] {
			return true
		}
	}

	return false
}

// RefreshHealthWithTestResults performs a health check on an existing repository,
// updates its status if needed, and returns the test results
func (hc *HealthChecker) RefreshHealthWithTestResults(ctx context.Context, repo repository.Repository) (*provisioning.TestResults, error) {
	if repo == nil {
		return nil, fmt.Errorf("repository is nil")
	}

	cfg := repo.Config()
	if cfg == nil {
		return nil, fmt.Errorf("repository config is nil")
	}

	// Run the test to get results
	testResults, err := hc.tester.TestRepository(ctx, repo)
	if err != nil {
		return nil, fmt.Errorf("failed to test repository: %w", err)
	}

	// Use health checker to perform comprehensive health check with existing status
	newHealthStatus := hc.CheckRepositoryHealth(ctx, repo, cfg.Status.Health)

	// Only update if health status actually changed
	if hc.HasHealthStatusChanged(cfg.Status.Health, newHealthStatus) {
		patchOp := map[string]interface{}{
			"op":    "replace",
			"path":  "/status/health",
			"value": newHealthStatus,
		}

		if err := hc.statusPatcher.Patch(ctx, cfg, patchOp); err != nil {
			return nil, fmt.Errorf("update health status: %w", err)
		}
	}

	return testResults, nil
}

// ShouldCheckHealth determines if a repository health check should be performed
func (hc *HealthChecker) ShouldCheckHealth(repo *provisioning.Repository) bool {
	if repo.Status.Health.Checked == 0 || repo.Generation != repo.Status.ObservedGeneration {
		return true
	}

	healthAge := time.Since(time.UnixMilli(repo.Status.Health.Checked))
	if repo.Status.Health.Healthy {
		return healthAge > time.Minute*5 // when healthy, check every 5 mins
	}

	return healthAge > time.Minute // otherwise within a minute
}

// RefreshHealth performs health check if needed and updates repository status
// Returns the current health status (either existing or newly checked)
func (hc *HealthChecker) RefreshHealth(ctx context.Context, repo repository.Repository, repoConfig *provisioning.Repository) (provisioning.HealthStatus, error) {
	// Perform comprehensive health check
	newHealthStatus := hc.CheckRepositoryHealth(ctx, repo, repoConfig.Status.Health)

	// Only update if health status actually changed
	if hc.HasHealthStatusChanged(repoConfig.Status.Health, newHealthStatus) {
		patchOp := map[string]interface{}{
			"op":    "replace",
			"path":  "/status/health",
			"value": newHealthStatus,
		}

		if err := hc.statusPatcher.Patch(ctx, repoConfig, patchOp); err != nil {
			return newHealthStatus, err // Return the new status even if patch failed
		}
	}

	return newHealthStatus, nil
}
