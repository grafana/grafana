package models

import (
	"context"
	"time"
)

type HealthStatus int

const (
	// StatusGreen means everything is working as expected in the service
	StatusGreen HealthStatus = iota
	// StatusYellow means degraded service performance, or that a check is not complete
	StatusYellow
	// StatusRed means there are critical failures in the service
	StatusRed
)

// Public health check configuration
type HealthCheckConfig struct {
	// A unique, non-empty name for a health check
	Name string
	// The category of health check
	Type HealthCheckType
	// How significant is a non-green status. For readiness and liveness checks, failure severity is always considered fatal.
	Severity HealthCheckSeverity
	// When should the health check be run
	Strategy HealthCheckStrategy
	// How often to run a cron-type check
	Interval time.Duration
	// How long to wait before running the check the first time
	InitialDelay time.Duration
	// Whether metrics for this check should be shown to anonymous users
	RequiresAuth bool
}

type GetHealthFunc func(ctx context.Context, name string) (HealthStatus, map[string]string, error)

type HealthCheckType string

const (
	// ReadinessCheck is a core check required to be registered and pass before the app is considered ready for traffic
	ReadinessCheck HealthCheckType = "readiness"
	// LivenessCheck is a check required to pass after the app is ready
	LivenessCheck HealthCheckType = "liveness"
	// DomainCheck is a check used for monitoring local service health and reporting primarily non-fatal issues
	DomainCheck HealthCheckType = "domain"
)

type HealthCheckSeverity string

const (
	// Minor checks are nice to know, but don't require intervention if there are errors
	SeverityMinor HealthCheckSeverity = "minor"
	// Major checks likely require intervention if there are errors
	SeverityMajor HealthCheckSeverity = "major"
	// Fatal checks mean the app requires a restart if there are errors
	SeverityFatal HealthCheckSeverity = "fatal"
)

type HealthCheckStrategy string

const (
	// Run the health check once, when registered, and store the result for the duration of the app's life
	StrategyOnce HealthCheckStrategy = "once"
	// Run the health check periodically, and store the result until the next time the job is run
	StrategyCron HealthCheckStrategy = "cron"
	// Send a health status whenever necessary, usually in response to some event
	StrategyOnDemand HealthCheckStrategy = "on-demand"
)

// Our representation of a health check
type HealthCheck struct {
	// Original config provided by the service during registration
	HealthCheckConfig HealthCheckConfig

	// Health check function to return health status
	HealthCheckFunc GetHealthFunc

	// Most recent health status
	LatestMetrics    map[string]string
	LatestStatus     HealthStatus
	LatestUpdateTime time.Time
}
