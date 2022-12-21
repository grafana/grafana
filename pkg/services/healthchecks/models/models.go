package models

import (
	"context"
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
	InitialDelay time.Duration
	RequiresAuth bool
}

type HealthFunc func(ctx context.Context, name string) (HealthStatus, map[string]string, error)

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
	HealthCheckConfig HealthCheckConfig

	// health check function to generate result
	HealthCheckFunc HealthFunc

	// cached results
	LatestMetrics    map[string]string
	LatestStatus     HealthStatus
	LatestUpdateTime time.Time
}
