package alertrule

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strconv"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apiserver/pkg/registry/rest"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/common"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
)

var validNotificationSettingsTypes = []string{
	string(ngmodels.NotificationSettingsTypeSimplifiedRouting),
	string(ngmodels.NotificationSettingsTypeNamedRoutingTree),
}

var (
	_ grafanarest.Storage = (*legacyStorage)(nil)
)

type legacyStorage struct {
	service        provisioning.AlertRuleService
	namespacer     request.NamespaceMapper
	tableConverter rest.TableConvertor
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

func (s *legacyStorage) List(ctx context.Context, opts *internalversion.ListOptions) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	groupFilter, err := common.ParseLabelSelectorFilter(opts.LabelSelector, model.GroupLabelKey)
	if err != nil {
		return nil, k8serrors.NewBadRequest(fmt.Sprintf("invalid label selector for %s: %s", model.GroupLabelKey, err))
	}
	folderFilter, err := common.ParseLabelSelectorFilter(opts.LabelSelector, model.FolderLabelKey)
	if err != nil {
		return nil, k8serrors.NewBadRequest(fmt.Sprintf("invalid label selector for %s: %s", model.FolderLabelKey, err))
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
				if err := common.AccumulateFieldSelectorFilter(&titleFilter, r, nil); err != nil {
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
				if err := common.AccumulateFieldSelectorFilter(&dashboardFilter, r, nil); err != nil {
					return nil, k8serrors.NewBadRequest(err.Error())
				}
			case "spec.panelRef.panelID":
				if err := common.AccumulateFieldSelectorFilter(&panelIDFilter, r, common.ValidateInt64String("spec.panelRef.panelID")); err != nil {
					return nil, k8serrors.NewBadRequest(err.Error())
				}
			case "spec.notificationSettings.type":
				if err := common.AccumulateFieldSelectorFilter(&notificationTypeFilter, r, common.ValidateOneOf("spec.notificationSettings.type", validNotificationSettingsTypes)); err != nil {
					return nil, k8serrors.NewBadRequest(err.Error())
				}
			case "spec.notificationSettings.receiver":
				if err := common.AccumulateFieldSelectorFilter(&receiverFilter, r, nil); err != nil {
					return nil, k8serrors.NewBadRequest(err.Error())
				}
			case "spec.notificationSettings.routingTree":
				if err := common.AccumulateFieldSelectorFilter(&routingTreeFilter, r, nil); err != nil {
					return nil, k8serrors.NewBadRequest(err.Error())
				}
			default:
				return nil, k8serrors.NewBadRequest(fmt.Sprintf("unknown field selector: %s", r.Field))
			}
		}
	}

	rules, provenanceMap, continueToken, err := s.service.ListAlertRules(ctx, user, provisioning.ListAlertRulesOptions{
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
	return convertToK8sResources(info.OrgID, rules, provenanceMap, s.namespacer, continueToken)
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

	rule, provenance, err := s.service.GetAlertRule(ctx, user, name)
	if err != nil {
		if errors.Is(err, ngmodels.ErrAlertRuleNotFound) {
			return nil, k8serrors.NewNotFound(ResourceInfo.GroupResource(), name)
		}
		return nil, err
	}

	obj, err := convertToK8sResource(info.OrgID, &rule, provenance, s.namespacer)
	if err != nil && errors.Is(err, errInvalidRule) {
		return nil, k8serrors.NewNotFound(ResourceInfo.GroupResource(), name)
	}
	return obj, err
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

	p, ok := obj.(*model.AlertRule)
	if !ok {
		return nil, k8serrors.NewBadRequest("expected valid alert rule object")
	}

	if p.GenerateName != "" {
		return nil, fmt.Errorf("generate-name is not supported in legacy storage mode")
	}
	model, provenance, err := convertToDomainModel(info.OrgID, p)
	if err != nil {
		return nil, err
	}

	created, err := s.service.CreateAlertRule(ctx, user, *model, provenance)
	if err != nil {
		return nil, err
	}

	return convertToK8sResource(info.OrgID, &created, provenance, s.namespacer)
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

	new, ok := obj.(*model.AlertRule)
	if !ok {
		return nil, false, k8serrors.NewBadRequest("expected valid alert rule object")
	}

	model, provenance, err := convertToDomainModel(info.OrgID, new)
	if err != nil {
		return old, false, err
	}

	// ignore returned rule as it doesn't contain the updated version
	_, err = s.service.UpdateAlertRule(ctx, user, *model, provenance)
	if err != nil {
		return nil, false, err
	}

	updated, provenance, err := s.service.GetAlertRule(ctx, user, name)
	if err != nil {
		return nil, false, err
	}

	rule, err := convertToK8sResource(info.OrgID, &updated, provenance, s.namespacer)
	if err != nil {
		return nil, false, err
	}

	return rule, false, nil
}

func (s *legacyStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, opts *metav1.DeleteOptions) (runtime.Object, bool, error) {
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
	p, ok := old.(*model.AlertRule)
	if !ok {
		return nil, false, k8serrors.NewBadRequest("expected valid recording rule object")
	}

	sourceProv := p.GetProvenanceStatus()
	if !slices.Contains(model.AcceptedProvenanceStatuses, sourceProv) {
		return nil, false, fmt.Errorf("invalid provenance status: %s", sourceProv)
	}
	provenance := ngmodels.Provenance(sourceProv)

	err = s.service.DeleteAlertRule(ctx, user, name, provenance)
	if err != nil {
		return old, false, err
	}

	return old, false, nil
}

func (s *legacyStorage) DeleteCollection(ctx context.Context, _ rest.ValidateObjectFunc, _ *metav1.DeleteOptions, _ *internalversion.ListOptions) (runtime.Object, error) {
	// TODO: support this once a pattern is established for bulk delete operations
	return nil, k8serrors.NewMethodNotSupported(ResourceInfo.GroupResource(), "delete")
}
