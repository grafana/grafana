package models

import (
	"time"

	"github.com/grafana/grafana/pkg/services/healthchecks"
)

type HealthStatus int

const (
	StatusGreen int = iota
	StatusYellow
	StatusRed
)

// Public health check configuration
type HealthCheckConfig struct {
	Name         string
	Type         HealthCheckType
	Severity     HealthCheckSeverity
	Strategy     HealthCheckStrategy
	Interval     time.Duration
	RequiresAuth bool
}

type HealthCheckType string

const (
	ReadinessCheck    HealthCheckType = "readiness"
	LivenessCheck     HealthCheckType = "liveness"
	DomainHealthCheck HealthCheckType = "domain"
)

type HealthCheckSeverity string

const (
	SeverityMinor HealthCheckSeverity = "minor"
	SeverityMajor HealthCheckSeverity = "major"
	SeverityFatal HealthCheckSeverity = "fatal"
)

type HealthCheckStrategy string

const (
	StrategyOnce     HealthCheckStrategy = "once"
	StrategyChron    HealthCheckStrategy = "chron"
	StrategyOnDemand HealthCheckStrategy = "on-demand"
)

//Internal representation of a health check
type healthCheck struct {
	// original config
	healthCheckConfig HealthCheckConfig
	healthChecker     healthchecks.HealthChecker

	// cached results
	latestMetrics    map[string]string
	latestStatus     HealthStatus
	latestUpdateTime time.Time
}
