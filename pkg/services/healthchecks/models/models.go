package models

import (
	"time"
)

type HealthStatus int

const (
	StatusGreen HealthStatus = iota
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

// Our representation of a health check
type HealthCheck struct {
	// original config
	healthCheckConfig HealthCheckConfig

	// cached results
	latestMetrics    map[string]string
	latestStatus     HealthStatus
	latestUpdateTime time.Time
}
