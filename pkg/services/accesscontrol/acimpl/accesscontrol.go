package acimpl

import (
	"context"
	"errors"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

var _ accesscontrol.AccessControl = new(AccessControl)

func ProvideAccessControl(cfg *setting.Cfg) *AccessControl {
	logger := log.New("accesscontrol")
	return &AccessControl{
		cfg, logger, accesscontrol.NewResolvers(logger),
	}
}

type AccessControl struct {
	cfg       *setting.Cfg
	log       log.Logger
	resolvers accesscontrol.Resolvers
}

func (a *AccessControl) Evaluate(ctx context.Context, user *user.SignedInUser, evaluator accesscontrol.Evaluator) (bool, error) {
	timer := prometheus.NewTimer(metrics.MAccessEvaluationsSummary)
	defer timer.ObserveDuration()
	metrics.MAccessEvaluationCount.Inc()

	if !verifyPermissions(user) {
		a.log.Warn("no permissions set for user", "userID", user.UserID, "orgID", user.OrgID, "login", user.Login)
		return false, nil
	}
	// Test evaluation without scope resolver first, this will prevent 403 for wildcard scopes when resource does not exist
	if evaluator.Evaluate(user.Permissions[user.OrgID]) {
		return true, nil
	}

	resolvedEvaluator, err := evaluator.MutateScopes(ctx, a.resolvers.GetScopeAttributeMutator(user.OrgID))
	if err != nil {
		if errors.Is(err, accesscontrol.ErrResolverNotFound) {
			return false, nil
		}
		return false, err
	}

	return resolvedEvaluator.Evaluate(user.Permissions[user.OrgID]), nil
}

func (a *AccessControl) RegisterScopeAttributeResolver(prefix string, resolver accesscontrol.ScopeAttributeResolver) {
	a.resolvers.AddScopeAttributeResolver(prefix, resolver)
}

func (a *AccessControl) EvaluateUserPermissions(ctx context.Context, cmd accesscontrol.EvaluateUserPermissionCommand) (map[string]accesscontrol.Metadata, error) {
	if !verifyPermissions(cmd.SignedInUser) {
		a.log.Warn("no permissions set for user", "userID", cmd.SignedInUser.UserID, "orgID", cmd.SignedInUser.OrgID)
		return map[string]accesscontrol.Metadata{}, nil
	}

	// Limit permissions to the action of interest
	if cmd.Action != "" {
		scopes, ok := cmd.SignedInUser.Permissions[cmd.SignedInUser.OrgID][cmd.Action]
		if !ok {
			return map[string]accesscontrol.Metadata{}, nil
		}
		cmd.SignedInUser.Permissions[cmd.SignedInUser.OrgID] = map[string][]string{cmd.Action: scopes}
	}

	// Only checking for an action
	if cmd.Action != "" && (cmd.Resource == "" && cmd.Attribute == "" && len(cmd.UIDs) == 0) {
		return map[string]accesscontrol.Metadata{"-": {cmd.Action: true}}, nil
	}

	// Compute metadata
	if cmd.Resource != "" && cmd.Attribute != "" && len(cmd.UIDs) != 0 {
		scopePrefix := accesscontrol.Scope(cmd.Resource, cmd.Attribute, "")
		uids := map[string]bool{}
		for _, uid := range cmd.UIDs {
			uids[uid] = true
		}
		return accesscontrol.GetResourcesMetadata(ctx, cmd.SignedInUser.Permissions[cmd.SignedInUser.OrgID], scopePrefix, uids), nil
	}

	return nil, errors.New("action or resource required")
}

func (a *AccessControl) IsDisabled() bool {
	return accesscontrol.IsDisabled(a.cfg)
}

func verifyPermissions(u *user.SignedInUser) bool {
	return u.Permissions != nil || u.Permissions[u.OrgID] != nil
}
