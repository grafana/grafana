package legacy

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// RecordingRules is the legacy rule service for the RecordingRule kind. It reads and writes v1beta1 objects and only
// ever returns recording rules: an alerting rule is reported as not found, and left out of lists. Manager properties
// are taken from, and returned on, the object's metadata.
//
// orgID is the org of the request's namespace. It is not always the user's org: Grafana server admins can call any
// org's namespace, so it is passed in rather than taken from the user.
type RecordingRules struct {
	service    *legacyRuleService
	namespacer request.NamespaceMapper
}

func newRecordingRules(service *legacyRuleService, namespacer request.NamespaceMapper) *RecordingRules {
	return &RecordingRules{service: service, namespacer: namespacer}
}

// List returns the recording rules that match opts. The continue token is set on the list metadata.
func (r *RecordingRules) List(ctx context.Context, user identity.Requester, orgID int64, opts ListAlertRulesOptions) (*v1beta1.RecordingRuleList, error) {
	opts.RuleType = models.RuleTypeFilterRecording
	rules, managers, next, err := r.service.ListAlertRules(ctx, user, opts)
	if err != nil {
		return nil, err
	}
	return RecordingRulesToK8s(orgID, rules, managers, r.namespacer, next)
}

// Get returns models.ErrAlertRuleNotFound if the rule does not exist or is an alerting rule.
func (r *RecordingRules) Get(ctx context.Context, user identity.Requester, orgID int64, name string) (*v1beta1.RecordingRule, error) {
	rule, managerProps, err := r.service.GetAlertRule(ctx, user, name)
	if err != nil {
		return nil, err
	}
	if rule.Type() != models.RuleTypeRecording {
		return nil, models.ErrAlertRuleNotFound
	}
	return RecordingRuleToK8s(orgID, &rule, managerProps, r.namespacer)
}

// History returns the stored versions of the rule, newest first.
func (r *RecordingRules) History(ctx context.Context, user identity.Requester, orgID int64, name string) (*v1beta1.RecordingRuleList, error) {
	versions, err := r.service.GetAlertRuleVersions(ctx, user, name)
	if err != nil {
		return nil, err
	}
	return RecordingRuleVersionsToK8s(orgID, versions, r.namespacer)
}

// Trash returns the deleted recording rules the user can read.
func (r *RecordingRules) Trash(ctx context.Context, user identity.Requester, orgID int64) (*v1beta1.RecordingRuleList, error) {
	deleted, err := r.service.GetDeletedAlertRules(ctx, user)
	if err != nil {
		return nil, err
	}
	return DeletedRecordingRulesToK8s(orgID, deleted, r.namespacer)
}

// Create returns the created rule, or with dryRun the rule that would have been created.
func (r *RecordingRules) Create(ctx context.Context, user identity.Requester, orgID int64, rule *v1beta1.RecordingRule, dryRun bool) (*v1beta1.RecordingRule, error) {
	model, managerProps, err := RecordingRuleFromK8sForWrite(orgID, rule)
	if err != nil {
		return nil, err
	}
	created, err := r.service.CreateAlertRule(ctx, user, *model, managerProps, dryRun)
	if err != nil {
		return nil, err
	}
	return RecordingRuleToK8s(orgID, &created, managerProps, r.namespacer)
}

// Update returns the stored rule after the update. With dryRun nothing is written and it returns the rule the update
// would have stored, which has no storage identity, version or status of its own.
func (r *RecordingRules) Update(ctx context.Context, user identity.Requester, orgID int64, rule *v1beta1.RecordingRule, dryRun bool) (*v1beta1.RecordingRule, error) {
	model, managerProps, err := RecordingRuleFromK8sForWrite(orgID, rule)
	if err != nil {
		return nil, err
	}
	if err := setUpdatePreconditions(rule, model); err != nil {
		return nil, err
	}
	result, err := r.service.UpdateAlertRule(ctx, user, *model, managerProps, dryRun)
	if err != nil {
		return nil, err
	}
	if dryRun {
		return RecordingRuleToK8s(orgID, &result, managerProps, r.namespacer)
	}
	// Storage sets the version and audit fields, so read the rule back.
	return r.Get(ctx, user, orgID, model.UID)
}

// Delete deletes the rule as the manager recorded on the object.
func (r *RecordingRules) Delete(ctx context.Context, user identity.Requester, orgID int64, rule *v1beta1.RecordingRule, dryRun bool) error {
	_, managerProps, err := RecordingRuleFromK8sForWrite(orgID, rule)
	if err != nil {
		return err
	}
	return r.service.DeleteAlertRule(ctx, user, rule.Name, managerProps, dryRun)
}

// SaveStatus stores the status subresource of the rule. It does not check the rule's kind or the user's access; the
// caller reads the rule through Get first.
func (r *RecordingRules) SaveStatus(ctx context.Context, orgID int64, name string, status v1beta1.RecordingRuleStatus) error {
	data, err := json.Marshal(status)
	if err != nil {
		return fmt.Errorf("failed to marshal status: %w", err)
	}
	return r.service.saveAlertRuleStatus(ctx, orgID, name, data)
}

// DeleteMany deletes the rules in one transaction, each as the manager recorded on its object. A single provenance or
// authorization failure rejects the whole batch.
func (r *RecordingRules) DeleteMany(ctx context.Context, user identity.Requester, orgID int64, rules []*v1beta1.RecordingRule, dryRun bool) error {
	targets := make([]*models.AlertRule, 0, len(rules))
	managers := make(map[string]utils.ManagerProperties, len(rules))
	for _, rule := range rules {
		model, managerProps, err := RecordingRuleFromK8sForWrite(orgID, rule)
		if err != nil {
			return fmt.Errorf("failed to convert rule %q: %w", rule.Name, err)
		}
		targets = append(targets, model)
		managers[model.UID] = managerProps
	}
	return r.service.DeleteAlertRules(ctx, user, targets, managers, dryRun)
}
