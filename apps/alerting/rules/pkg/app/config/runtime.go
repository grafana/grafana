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

type RuleSequenceMembership struct {
	SequenceUID string
	Found       bool
}

var (
	ErrInvalidRuntimeConfig = errors.New("invalid runtime config provided to alerting/rules app")
)

// RuleSequenceMembershipResolver resolves which RuleSequence (if any) owns a
// given set of rule UIDs. Implementations must be safe for concurrent use.
type RuleSequenceMembershipResolver interface {
	Resolve(ctx context.Context, uids []string) (map[string]RuleSequenceMembership, error)
}

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
	// MembershipResolver is used by admission validators to look up which
	// RuleSequence (if any) owns a rule UID. The default implementation is a
	// watch-backed in-memory index that provides O(1) lookups.
	MembershipResolver RuleSequenceMembershipResolver
}
