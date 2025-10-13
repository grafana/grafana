package fakes

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
)

type Call struct {
	MethodName string
	Arguments  []interface{}
}

type FakeRuleService struct {
	HasAccessFunc                             func(context.Context, identity.Requester, ac.Evaluator) (bool, error)
	HasAccessOrErrorFunc                      func(context.Context, identity.Requester, ac.Evaluator, func() string) error
	AuthorizeDatasourceAccessForRuleFunc      func(context.Context, identity.Requester, *models.AlertRule) error
	AuthorizeDatasourceAccessForRuleGroupFunc func(context.Context, identity.Requester, models.RulesGroup) error
	HasAccessToRuleGroupFunc                  func(context.Context, identity.Requester, models.RulesGroup) (bool, error)
	AuthorizeAccessToRuleGroupFunc            func(context.Context, identity.Requester, models.RulesGroup) error
	HasAccessInFolderFunc                     func(context.Context, identity.Requester, models.Namespaced) (bool, error)
	AuthorizeAccessInFolderFunc               func(context.Context, identity.Requester, models.Namespaced) error
	AuthorizeRuleChangesFunc                  func(context.Context, identity.Requester, *store.GroupDelta) error
	CanReadAllRulesFunc                       func(context.Context, identity.Requester) (bool, error)

	Calls []Call
}

func (s *FakeRuleService) HasAccess(ctx context.Context, user identity.Requester, evaluator ac.Evaluator) (bool, error) {
	s.Calls = append(s.Calls, Call{"HasAccess", []interface{}{ctx, user, evaluator}})
	if s.HasAccessFunc != nil {
		return s.HasAccessFunc(ctx, user, evaluator)
	}
	return false, nil
}

func (s *FakeRuleService) HasAccessOrError(ctx context.Context, user identity.Requester, evaluator ac.Evaluator, action func() string) error {
	s.Calls = append(s.Calls, Call{"HasAccessOrError", []interface{}{ctx, user, evaluator, action}})
	if s.HasAccessOrErrorFunc != nil {
		return s.HasAccessOrErrorFunc(ctx, user, evaluator, action)
	}
	return nil
}

func (s *FakeRuleService) AuthorizeDatasourceAccessForRule(ctx context.Context, user identity.Requester, rule *models.AlertRule) error {
	s.Calls = append(s.Calls, Call{"AuthorizeDatasourceAccessForRule", []interface{}{ctx, user, rule}})
	if s.AuthorizeDatasourceAccessForRuleFunc != nil {
		return s.AuthorizeDatasourceAccessForRuleFunc(ctx, user, rule)
	}
	return nil
}

func (s *FakeRuleService) AuthorizeDatasourceAccessForRuleGroup(ctx context.Context, user identity.Requester, rules models.RulesGroup) error {
	s.Calls = append(s.Calls, Call{"AuthorizeDatasourceAccessForRuleGroup", []interface{}{ctx, user, rules}})
	if s.AuthorizeDatasourceAccessForRuleGroupFunc != nil {
		return s.AuthorizeDatasourceAccessForRuleGroupFunc(ctx, user, rules)
	}
	return nil
}

func (s *FakeRuleService) HasAccessToRuleGroup(ctx context.Context, user identity.Requester, rules models.RulesGroup) (bool, error) {
	s.Calls = append(s.Calls, Call{"HasAccessToRuleGroup", []interface{}{ctx, user, rules}})
	if s.HasAccessToRuleGroupFunc != nil {
		return s.HasAccessToRuleGroupFunc(ctx, user, rules)
	}
	return false, nil
}

func (s *FakeRuleService) AuthorizeAccessToRuleGroup(ctx context.Context, user identity.Requester, rules models.RulesGroup) error {
	s.Calls = append(s.Calls, Call{"AuthorizeRuleGroupRead", []interface{}{ctx, user, rules}})
	if s.AuthorizeAccessToRuleGroupFunc != nil {
		return s.AuthorizeAccessToRuleGroupFunc(ctx, user, rules)
	}
	return nil
}

func (s *FakeRuleService) HasAccessInFolder(ctx context.Context, user identity.Requester, namespaced models.Namespaced) (bool, error) {
	s.Calls = append(s.Calls, Call{"HasAccessInFolder", []interface{}{ctx, user, namespaced}})
	if s.HasAccessInFolderFunc != nil {
		return s.HasAccessInFolderFunc(ctx, user, namespaced)
	}
	return false, nil
}

func (s *FakeRuleService) AuthorizeAccessInFolder(ctx context.Context, user identity.Requester, namespaced models.Namespaced) error {
	s.Calls = append(s.Calls, Call{"AuthorizeAccessInFolder", []interface{}{ctx, user, namespaced}})
	if s.AuthorizeAccessInFolderFunc != nil {
		return s.AuthorizeAccessInFolderFunc(ctx, user, namespaced)
	}
	return nil
}

func (s *FakeRuleService) AuthorizeRuleChanges(ctx context.Context, user identity.Requester, change *store.GroupDelta) error {
	s.Calls = append(s.Calls, Call{"AuthorizeRuleGroupWrite", []interface{}{ctx, user, change}})
	if s.AuthorizeRuleChangesFunc != nil {
		return s.AuthorizeRuleChangesFunc(ctx, user, change)
	}
	return nil
}

func (s *FakeRuleService) CanReadAllRules(ctx context.Context, user identity.Requester) (bool, error) {
	s.Calls = append(s.Calls, Call{"CanReadAllRules", []interface{}{ctx, user}})
	if s.CanReadAllRulesFunc != nil {
		return s.CanReadAllRulesFunc(ctx, user)
	}
	return false, nil
}
