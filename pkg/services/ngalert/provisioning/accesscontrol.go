package provisioning

import (
	"context"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
)

type RuleAccessControlService interface {
	HasAccess(ctx context.Context, user identity.Requester, evaluator ac.Evaluator) (bool, error)
	AuthorizeAccessToRuleGroup(ctx context.Context, user identity.Requester, rules models.RulesGroup) error
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

func (p *provisioningRuleAccessControl) AuthorizeRuleGroupRead(ctx context.Context, user identity.Requester, rules models.RulesGroup) error {
	if can, err := p.CanReadAllRules(ctx, user); can || err != nil {
		return err
	}
	return p.RuleAccessControlService.AuthorizeAccessToRuleGroup(ctx, user, rules)
}

func (p *provisioningRuleAccessControl) AuthorizeRuleGroupWrite(ctx context.Context, user identity.Requester, change *store.GroupDelta) error {
	if can, err := p.CanWriteAllRules(ctx, user); can || err != nil {
		return err
	}
	return p.RuleAccessControlService.AuthorizeRuleChanges(ctx, user, change)
}

func (p *provisioningRuleAccessControl) CanReadAllRules(ctx context.Context, user identity.Requester) (bool, error) {
	return p.HasAccess(ctx, user, ac.EvalAny(
		ac.EvalPermission(ac.ActionAlertingProvisioningRead),
		ac.EvalPermission(ac.ActionAlertingProvisioningReadSecrets),
	))
}

func (p *provisioningRuleAccessControl) CanWriteAllRules(ctx context.Context, user identity.Requester) (bool, error) {
	return p.HasAccess(ctx, user, ac.EvalPermission(ac.ActionAlertingProvisioningWrite))
}
