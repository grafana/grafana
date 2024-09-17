package pipeline

import "context"

// RuleBuilder constructs in-memory representation of channel rules.
type RuleBuilder interface {
	BuildRules(ctx context.Context, orgID int64) ([]*LiveChannelRule, error)
}
