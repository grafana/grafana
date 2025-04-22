package provisioning

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
)

type RuleAccessControlService interface {
	HasAccess(ctx context.Context, user identity.Requester, evaluator ac.Evaluator) (bool, error)
	AuthorizeAccessToRuleGroup(ctx context.Context, user identity.Requester, rules models.RulesGroup) error
	AuthorizeAccessInFolder(ctx context.Context, user identity.Requester, namespaced models.Namespaced) error
	AuthorizeRuleChanges(ctx context.Context, user identity.Requester, change *store.GroupDelta) error
}

func newRuleAccessControlService(ac RuleAccessControlService) *provisioningRuleAccessControl {
	return &provisioningRuleAccessControl{
		RuleAccessControlService: ac,
	}
}

type provisioningRuleAccessControl struct {
	RuleAccessControlService
}

var _ ruleAccessControlService = &provisioningRuleAccessControl{}

// AuthorizeRuleRead authorizes the read access to a rule for a user.
// It first checks if the user has permission to read all rules. If yes, it bypasses the authorization.
// If not, it calls the RuleAccessControlService to authorize access to the rule.
// It returns an error if the authorization fails or if there is an error during permission check.
func (p *provisioningRuleAccessControl) AuthorizeRuleRead(ctx context.Context, user identity.Requester, rule *models.AlertRule) error {
	can, err := p.CanReadAllRules(ctx, user)
	if err != nil {
		return err
	}
	if !can {
		return p.AuthorizeAccessInFolder(ctx, user, rule)
	}
	return nil
}

// AuthorizeRuleGroupRead authorizes the read access to a group of rules for a user.
// It first checks if the user has permission to read all rules. If yes, it bypasses the authorization.
// If not, it calls the RuleAccessControlService to authorize access to the rule group.
// It returns an error if the authorization fails or if there is an error during permission check.
func (p *provisioningRuleAccessControl) AuthorizeRuleGroupRead(ctx context.Context, user identity.Requester, rules models.RulesGroup) error {
	can, err := p.CanReadAllRules(ctx, user)
	if err != nil {
		return err
	}
	if !can {
		return p.AuthorizeAccessToRuleGroup(ctx, user, rules)
	}
	return nil
}

// AuthorizeRuleGroupWrite authorizes the write access to a group of rules for a user.
// It first checks if the user has permission to write all rules. If yes, it bypasses the authorization.
// If not, it calls the RuleAccessControlService to authorize the rule changes.
// It returns an error if the authorization fails or if there is an error during permission check.
func (p *provisioningRuleAccessControl) AuthorizeRuleGroupWrite(ctx context.Context, user identity.Requester, change *store.GroupDelta) error {
	can, err := p.CanWriteAllRules(ctx, user)
	if err != nil {
		return err
	}
	if !can {
		return p.AuthorizeRuleChanges(ctx, user, change)
	}
	return nil
}

// CanReadAllRules checks if the user has permission to read all rules.
// It evaluates if the user has either "alert.provisioning:read" or "alert.provisioning.secrets:read" permissions.
// It returns true if the user has the required permissions, otherwise it returns false.
func (p *provisioningRuleAccessControl) CanReadAllRules(ctx context.Context, user identity.Requester) (bool, error) {
	return p.HasAccess(ctx, user, ac.EvalAny(
		ac.EvalPermission(ac.ActionAlertingProvisioningRead),
		ac.EvalPermission(ac.ActionAlertingProvisioningReadSecrets),
		ac.EvalPermission(ac.ActionAlertingRulesProvisioningRead),
	))
}

// CanWriteAllRules is a method that checks if a user has permission to write all rules.
// It calls the HasAccess method with the provided action "alert.provisioning:write".
// It returns true if the user has permission, false otherwise.
// It returns an error if there is a problem checking the permission.
func (p *provisioningRuleAccessControl) CanWriteAllRules(ctx context.Context, user identity.Requester) (bool, error) {
	return p.HasAccess(ctx, user, ac.EvalAny(
		ac.EvalPermission(ac.ActionAlertingProvisioningWrite),
		ac.EvalPermission(ac.ActionAlertingRulesProvisioningWrite),
	))
}
