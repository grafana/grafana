package config

import (
	"context"
	"errors"
	"time"
)

var (
	ErrInvalidRuntimeConfig = errors.New("invalid runtime config provided to alerting/rules app")
)

// RuntimeConfig holds configuration values needed at runtime by the alerting/rules app from the running Grafana instance.
type RuntimeConfig struct {
	// function to check folder existence given its uid
	FolderValidator func(ctx context.Context, folderUID string) (bool, error)
	// base evaluation interval
	BaseEvaluationInterval time.Duration
	// set of strings which are illegal for label keys on rules
	ReservedLabelKeys             map[string]struct{}
	NotificationSettingsValidator func(ctx context.Context, receiver string) (bool, error)
}
