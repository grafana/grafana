package alertrule

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"time"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
)

var logger = log.New("alerting.rules.k8s")

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
	startTotal := time.Now()

	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	// Extract filter parameters from request context or query parameters
	filters := extractFiltersFromListOptions(ctx, opts)

	// Time: Provisioning layer (DB + authorization + filtering)
	startProvisioning := time.Now()
	rules, provenanceMap, continueToken, err := s.service.ListAlertRules(ctx, user, provisioning.ListAlertRulesOptions{
		RuleType:      ngmodels.RuleTypeFilterAlerting,
		Limit:         opts.Limit,
		ContinueToken: opts.Continue,

		// Filter options
		Namespace:        filters.Namespace,
		GroupName:        filters.GroupName,
		RuleName:         filters.RuleName,
		Labels:           filters.Labels,
		DashboardUID:     filters.DashboardUID,
		ContactPointName: filters.ContactPointName,
		HidePluginRules:  filters.HidePluginRules,
	})
	provisioningDuration := time.Since(startProvisioning)

	if err != nil {
		return nil, err
	}

	// Time: K8s conversion
	startConversion := time.Now()
	result, err := convertToK8sResources(info.OrgID, rules, provenanceMap, s.namespacer, continueToken)
	conversionDuration := time.Since(startConversion)

	totalDuration := time.Since(startTotal)

	logger.Info("K8s AlertRules List performance",
		"rule_count", len(rules),
		"total_ms", totalDuration.Milliseconds(),
		"provisioning_ms", provisioningDuration.Milliseconds(),
		"conversion_ms", conversionDuration.Milliseconds(),
		"org_id", info.OrgID)

	return result, err
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
	// TODO: move this to the validation function
	if p.Labels[model.GroupLabelKey] != "" || p.Labels[model.GroupIndexLabelKey] != "" {
		return nil, k8serrors.NewBadRequest("cannot set group when creating alert rule")
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

	current, ok := old.(*model.AlertRule)
	if !ok {
		// this shouldn't really be possible
		return nil, false, k8serrors.NewBadRequest("expected valid alert rule object")
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
	if current.Labels[model.GroupLabelKey] == "" && new.Labels[model.GroupLabelKey] != "" {
		return nil, false, k8serrors.NewBadRequest("cannot set group label when updating un-grouped alert rule")
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

// filterOptions holds filter parameters for listing rules
type filterOptions struct {
	Namespace        string
	GroupName        string
	RuleName         string
	Labels           []string
	DashboardUID     string
	ContactPointName string
	HidePluginRules  bool
}

// extractFiltersFromListOptions extracts filter parameters from K8s ListOptions
// Filters are expected to be passed as query parameters in the HTTP request
func extractFiltersFromListOptions(ctx context.Context, opts *internalversion.ListOptions) filterOptions {
	// For now, we extract from field selectors or label selectors
	// In the future, these might come from custom query parameters
	filters := filterOptions{}

	// Extract filters from field selector if present
	if opts != nil && opts.FieldSelector != nil {
		// Field selectors could be used for exact matches like namespace or dashboardUID
		// Format: metadata.namespace=value, spec.title=value, etc.
		// For now, we'll leave this empty and expect filters from query params
	}

	// Extract filters from label selector if present
	if opts != nil && opts.LabelSelector != nil {
		// Label selectors could be used for label matching
		// Format: severity=critical, team=backend, etc.
	}

	// TODO: Extract from actual HTTP request query parameters
	// This would require access to the HTTP request context
	// For now, return empty filters - frontend team will need to implement
	// the query parameter extraction based on how K8s API passes custom params

	return filters
}
