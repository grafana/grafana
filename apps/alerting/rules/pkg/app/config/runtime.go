package config

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
)

type RuleRef struct {
	UID       string
	FolderUID string
}

type RuleChainMembership struct {
	ChainUID string
	Found    bool
}

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
	NotificationSettingsValidator func(ctx context.Context, notificationSettings v0alpha1.AlertRuleNotificationSettings) error
	ResolveRuleRef                func(ctx context.Context, uid string) (RuleRef, bool, error)
	// ResolveRuleChainMemberships is used by RuleChain CREATE/UPDATE admission validation to
	// resolve membership for all rule refs in the incoming RuleChain object in one call.
	// This avoids repeating expensive membership scans per referenced UID.
	ResolveRuleChainMemberships func(ctx context.Context, uids []string) (map[string]RuleChainMembership, error)
}
