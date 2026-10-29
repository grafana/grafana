package alertrule

import (
	"context"
	"errors"
	"fmt"
	"strconv"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v1beta1"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/convert"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/common"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	ngalertaccesscontrol "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
)

var validNotificationSettingsTypes = []string{
	string(ngmodels.NotificationSettingsTypeSimplifiedRouting),
	string(ngmodels.NotificationSettingsTypeNamedRoutingTree),
}

// onlyAlertingVersions filters versions to those representing alerting rules. Versions of
// recording rules share storage but should not surface through the AlertRule resource.
func onlyAlertingVersions(versions []*ngmodels.AlertRuleVersion) []*ngmodels.AlertRuleVersion {
	out := versions[:0]
	for _, v := range versions {
		if v == nil {
			continue
		}
		if v.Type() != ngmodels.RuleTypeAlerting {
			continue
		}
		out = append(out, v)
	}
	return out
}

// onlyAlertingRules filters deleted rules to those representing alerting rules.
func onlyAlertingRules(rules []*ngmodels.AlertRule) []*ngmodels.AlertRule {
	out := rules[:0]
	for _, r := range rules {
		if r == nil {
			continue
		}
		if r.Type() != ngmodels.RuleTypeAlerting {
			continue
		}
		out = append(out, r)
	}
	return out
}

var (
	_ grafanarest.Storage    = (*legacyStorage)(nil)
	_ rest.CollectionDeleter = (*legacyStorage)(nil)
)

// toAPIError classifies errors from the alert rule service into the matching apierrors status.
func toAPIError(name string, err error) error {
	switch {
	case errors.Is(err, ngmodels.ErrAlertRuleFailedValidation):
		return k8serrors.NewBadRequest(err.Error())
	case errors.Is(err, ngmodels.ErrQuotaReached):
		return k8serrors.NewForbidden(ResourceInfo.GroupResource(), name, err)
	case errors.Is(err, ngmodels.ErrAlertRuleNotFound):
		return k8serrors.NewNotFound(ResourceInfo.GroupResource(), name)
	default:
		return err
	}
}

type legacyStorage struct {
	service        provisioning.AlertRuleService
	namespacer     request.NamespaceMapper
	tableConverter rest.TableConvertor
	// ruleAccess computes the grafana.com/access/canWrite and .../canDelete
	// response annotations on GET and LIST. nil (e.g. in a test that does not
	// need them) means neither is ever set.
	ruleAccess *ngalertaccesscontrol.RuleService
}

// setAccessAnnotations sets the requester-specific canWrite/canDelete hint
// annotations on obj for rule, using the same access-control service and
// evaluators the rule mutation path (accesscontrol.RuleService,
// AuthorizeRuleChanges) checks -- not a separate reimplementation. Only ever
// called from Get/List: Create/Update/Delete never attach it, so a
// client-supplied annotation is never echoed back or persisted.
func (s *legacyStorage) setAccessAnnotations(ctx context.Context, user identity.Requester, rule ngmodels.Namespaced, obj accessAnnotatable) error {
	if s.ruleAccess == nil {
		return nil
	}
	canWrite, err := common.CanWriteRule(ctx, s.ruleAccess, user, rule)
	if err != nil {
		return err
	}
	if canWrite {
		obj.SetAccessControl("canWrite")
	}
	canDelete, err := common.CanDeleteRule(ctx, s.ruleAccess, user, rule)
	if err != nil {
		return err
	}
	if canDelete {
		obj.SetAccessControl("canDelete")
	}
	return nil
}

// accessAnnotatable is the SetAccessControl method model.AlertRule and
// model.RecordingRule each generate (see alertrule_ext.go/recordingrule_ext.go).
type accessAnnotatable interface {
	SetAccessControl(action string)
}

func (s *legacyStorage) New() runtime.Object {
	return ResourceInfo.NewFunc()
}

func (s *legacyStorage) Destroy() {}

func (s *legacyStorage) NamespaceScoped() bool {
	return true
}

func (s *legacyStorage) GetSingularName() string {
	return ResourceInfo.GetSingularName()
}

func (s *legacyStorage) NewList() runtime.Object {
	return ResourceInfo.NewListFunc()
}

func (s *legacyStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

// listSpecialMode handles the reserved label selectors (grafana.app/get-history and
// grafana.app/get-trash). It returns handled=true when the selector matched and the result was
// produced; callers should otherwise continue with the regular list pipeline.
func (s *legacyStorage) listSpecialMode(ctx context.Context, orgID int64, user identity.Requester, opts *internalversion.ListOptions) (runtime.Object, bool, error) {
	mode, ruleName, err := common.ParseListMode(opts.LabelSelector, opts.FieldSelector)
	if err != nil {
		return nil, true, k8serrors.NewBadRequest(err.Error())
	}
	switch mode {
	case common.ListModeHistory:
		versions, err := s.service.GetAlertRuleVersions(ctx, user, ruleName)
		if err != nil {
			if errors.Is(err, ngmodels.ErrAlertRuleNotFound) {
				return nil, true, k8serrors.NewNotFound(ResourceInfo.GroupResource(), ruleName)
			}
			return nil, true, err
		}
		out, err := convertVersionsToK8sResources(orgID, onlyAlertingVersions(versions), s.namespacer)
		return out, true, err
	case common.ListModeTrash:
		deleted, err := s.service.GetDeletedAlertRules(ctx, user)
		if err != nil {
			return nil, true, err
		}
		out, err := convertDeletedToK8sResources(orgID, onlyAlertingRules(deleted), s.namespacer)
		return out, true, err
	case common.ListModeNormal:
	}
	return nil, false, nil
}

func (s *legacyStorage) List(ctx context.Context, opts *internalversion.ListOptions) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	if out, handled, err := s.listSpecialMode(ctx, info.OrgID, user, opts); handled || err != nil {
		return out, err
	}

	groupFilter, err := common.ParseLabelSelectorFilter(opts.LabelSelector, v1beta1.GroupLabelKey)
	if err != nil {
		return nil, k8serrors.NewBadRequest(fmt.Sprintf("invalid label selector for %s: %s", v1beta1.GroupLabelKey, err))
	}
	folderFilter, err := common.ParseLabelSelectorFilter(opts.LabelSelector, v1beta1.FolderLabelKey)
	if err != nil {
		return nil, k8serrors.NewBadRequest(fmt.Sprintf("invalid label selector for %s: %s", v1beta1.FolderLabelKey, err))
	}

	var (
		titleFilter            provisioning.ListRuleStringFilter
		pausedFilter           provisioning.ListRuleBoolFilter
		dashboardFilter        provisioning.ListRuleStringFilter
		panelIDFilter          provisioning.ListRuleStringFilter
		notificationTypeFilter provisioning.ListRuleStringFilter
		receiverFilter         provisioning.ListRuleStringFilter
		routingTreeFilter      provisioning.ListRuleStringFilter
	)
	if opts.FieldSelector != nil && !opts.FieldSelector.Empty() {
		for _, r := range opts.FieldSelector.Requirements() {
			switch r.Field {
			case "spec.title":
				if err := common.ApplyFieldSelectorRequirement(&titleFilter, r, nil); err != nil {
					return nil, k8serrors.NewBadRequest(err.Error())
				}
			case "spec.paused":
				v, err := strconv.ParseBool(r.Value)
				if err != nil {
					return nil, k8serrors.NewBadRequest(fmt.Sprintf("invalid value for spec.paused: %s", r.Value))
				}
				switch r.Operator {
				case selection.Equals, selection.DoubleEquals:
					pausedFilter.Value = &v
				case selection.NotEquals:
					negated := !v
					pausedFilter.Value = &negated
				default:
					return nil, k8serrors.NewBadRequest(fmt.Sprintf("unsupported operator %q for spec.paused (only =, ==, != are supported)", r.Operator))
				}
			case "spec.panelRef.dashboardUID":
				if err := common.ApplyFieldSelectorRequirement(&dashboardFilter, r, nil); err != nil {
					return nil, k8serrors.NewBadRequest(err.Error())
				}
			case "spec.panelRef.panelID":
				if err := common.ApplyFieldSelectorRequirement(&panelIDFilter, r, common.ValidateInt64String("spec.panelRef.panelID")); err != nil {
					return nil, k8serrors.NewBadRequest(err.Error())
				}
			case "spec.notificationSettings.type":
				if err := common.ApplyFieldSelectorRequirement(&notificationTypeFilter, r, common.ValidateOneOf("spec.notificationSettings.type", validNotificationSettingsTypes)); err != nil {
					return nil, k8serrors.NewBadRequest(err.Error())
				}
			case "spec.notificationSettings.receiver":
				if err := common.ApplyFieldSelectorRequirement(&receiverFilter, r, nil); err != nil {
					return nil, k8serrors.NewBadRequest(err.Error())
				}
			case "spec.notificationSettings.routingTree":
				if err := common.ApplyFieldSelectorRequirement(&routingTreeFilter, r, nil); err != nil {
					return nil, k8serrors.NewBadRequest(err.Error())
				}
			default:
				return nil, k8serrors.NewBadRequest(fmt.Sprintf("unknown field selector: %s", r.Field))
			}
		}
	}

	rules, managerPropsMap, continueToken, err := s.service.ListAlertRules(ctx, user, provisioning.ListAlertRulesOptions{
		RuleType:               ngmodels.RuleTypeFilterAlerting,
		Limit:                  opts.Limit,
		ContinueToken:          opts.Continue,
		GroupFilter:            groupFilter,
		FolderFilter:           folderFilter,
		TitleFilter:            titleFilter,
		PausedFilter:           pausedFilter,
		DashboardFilter:        dashboardFilter,
		PanelIDFilter:          panelIDFilter,
		NotificationTypeFilter: notificationTypeFilter,
		ReceiverFilter:         receiverFilter,
		RoutingTreeFilter:      routingTreeFilter,
	})
	if err != nil {
		return nil, err
	}
	result, err := convertToK8sResources(info.OrgID, rules, managerPropsMap, s.namespacer, continueToken)
	if err != nil {
		return nil, err
	}
	for i, rule := range rules {
		if err := s.setAccessAnnotations(ctx, user, rule, &result.Items[i]); err != nil {
			return nil, err
		}
	}
	return result, nil
}

func (s *legacyStorage) Get(ctx context.Context, name string, _ *metav1.GetOptions) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	rule, managerProps, err := s.service.GetAlertRule(ctx, user, name)
	if err != nil {
		if errors.Is(err, ngmodels.ErrAlertRuleNotFound) {
			return nil, k8serrors.NewNotFound(ResourceInfo.GroupResource(), name)
		}
		return nil, err
	}

	obj, err := convertToK8sResource(info.OrgID, &rule, managerProps, s.namespacer)
	if err != nil {
		if errors.Is(err, errInvalidRule) {
			return nil, k8serrors.NewNotFound(ResourceInfo.GroupResource(), name)
		}
		return nil, err
	}
	if err := s.setAccessAnnotations(ctx, user, &rule, obj); err != nil {
		return nil, err
	}
	return obj, nil
}

func (s *legacyStorage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, _ *metav1.CreateOptions) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	if createValidation != nil {
		if err := createValidation(ctx, obj); err != nil {
			return nil, err
		}
	}

	// The dual writer can pass the object in the version of the request.
	p, err := convert.Hub[*v1beta1.AlertRule](obj)
	if err != nil {
		return nil, k8serrors.NewBadRequest("expected valid alert rule object")
	}

	if p.GenerateName != "" {
		return nil, fmt.Errorf("generate-name is not supported in legacy storage mode")
	}
	domainModel, managerProps, err := convertToDomainModel(info.OrgID, p)
	if err != nil {
		return nil, err
	}

	created, err := s.service.CreateAlertRule(ctx, user, *domainModel, managerProps)
	if err != nil {
		return nil, toAPIError(p.GetName(), err)
	}

	return convertToK8sResource(info.OrgID, &created, managerProps, s.namespacer)
}

func (s *legacyStorage) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, false, err
	}

	old, err := s.Get(ctx, name, nil)
	if err != nil {
		return old, false, err
	}

	obj, err := objInfo.UpdatedObject(ctx, old)
	if err != nil {
		return old, false, err
	}
	if updateValidation != nil {
		if err := updateValidation(ctx, obj, old); err != nil {
			return nil, false, err
		}
	}

	new, err := convert.Hub[*v1beta1.AlertRule](obj)
	if err != nil {
		return nil, false, k8serrors.NewBadRequest("expected valid alert rule object")
	}

	domainModel, managerProps, err := convertToDomainModel(info.OrgID, new)
	if err != nil {
		return old, false, err
	}

	_, err = s.service.UpdateAlertRule(ctx, user, *domainModel, managerProps)
	if err != nil {
		return nil, false, toAPIError(name, err)
	}

	updated, managerProps, err := s.service.GetAlertRule(ctx, user, name)
	if err != nil {
		return nil, false, err
	}

	rule, err := convertToK8sResource(info.OrgID, &updated, managerProps, s.namespacer)
	if err != nil {
		return nil, false, err
	}

	return rule, false, nil
}

func (s *legacyStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, opts *metav1.DeleteOptions) (runtime.Object, bool, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, false, err
	}

	old, err := s.Get(ctx, name, nil)
	if err != nil {
		return old, false, err
	}
	if deleteValidation != nil {
		if err := deleteValidation(ctx, old); err != nil {
			return nil, false, err
		}
	}
	p, err := convert.Hub[*v1beta1.AlertRule](old)
	if err != nil {
		return nil, false, k8serrors.NewBadRequest("expected valid alert rule object")
	}

	// Derive manager properties the same way create/update do, so a resource managed
	// by a specific manager (e.g. Terraform) is deleted with the matching manager and
	// not the coarser provenance-derived equivalent.
	_, managerProps, err := convertToDomainModel(info.OrgID, p)
	if err != nil {
		return nil, false, err
	}

	err = s.service.DeleteAlertRule(ctx, user, name, managerProps)
	if err != nil {
		return old, false, err
	}

	return old, false, nil
}

func (s *legacyStorage) DeleteCollection(_ context.Context, _ rest.ValidateObjectFunc, _ *metav1.DeleteOptions, _ *internalversion.ListOptions) (runtime.Object, error) {
	// The dual-writer requires this interface even after migration routes
	// collection deletion to unified storage. Legacy rows use the org SQL sweep.
	return nil, k8serrors.NewMethodNotSupported(ResourceInfo.GroupResource(), "delete")
}
