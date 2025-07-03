package recordingrule

import (
	"context"
	"errors"
	"fmt"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
)

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
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	rules, _, continueToken, err := s.service.ListAlertRules(ctx, user, provisioning.ListAlertRulesOptions{
		RuleType:      ngmodels.RuleTypeFilterRecording,
		Limit:         opts.Limit,
		ContinueToken: opts.Continue,
		// TODO: add field selectors for filtering
		// TODO: add label selectors for filtering on group and folders
	})
	if err != nil {
		return nil, err
	}

	return ConvertToK8sResources(user.GetOrgID(), rules, s.namespacer, continueToken)
}

func (s *legacyStorage) Get(ctx context.Context, name string, _ *metav1.GetOptions) (runtime.Object, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	rule, _, err := s.service.GetAlertRule(ctx, user, name)
	if err != nil {
		return nil, err
	}

	obj, err := ConvertToK8sResource(user.GetOrgID(), &rule, s.namespacer)
	if err != nil && errors.Is(err, invalidRuleError) {
		return nil, k8serrors.NewNotFound(ResourceInfo.GroupResource(), name)
	}
	return obj, err
}

func (s *legacyStorage) Create(ctx context.Context, obj runtime.Object, _ rest.ValidateObjectFunc, _ *metav1.CreateOptions) (runtime.Object, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	p, ok := obj.(*model.RecordingRule)
	if !ok {
		return nil, fmt.Errorf("expected recording rule but got %T", obj)
	}
	if p.Name != "" {
		return nil, k8serrors.NewBadRequest("object's metadata.name should be empty")
	}

	model, err := ConvertToDomainModel(p)
	if err != nil {
		return nil, err
	}

	rule, err := s.service.CreateAlertRule(ctx, user, *model, ngmodels.ProvenanceNone)
	if err != nil {
		return nil, err
	}

	return ConvertToK8sResource(user.GetOrgID(), &rule, s.namespacer)
}

func (s *legacyStorage) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, _ rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, _ bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, false, err
	}

	old, err := s.Get(ctx, name, nil)
	if err != nil {
		return nil, false, err
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

	p, ok := obj.(*model.RecordingRule)
	if !ok {
		return nil, false, fmt.Errorf("expected recording rule but got %T", obj)
	}

	model, err := ConvertToDomainModel(p)
	if err != nil {
		return nil, false, err
	}

	updated, err := s.service.UpdateAlertRule(ctx, user, *model, ngmodels.ProvenanceNone)
	if err != nil {
		return nil, false, err
	}

	rule, err := ConvertToK8sResource(user.GetOrgID(), &updated, s.namespacer)
	if err != nil {
		return nil, false, err
	}

	return rule, true, nil
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

	err = s.service.DeleteAlertRule(ctx, user, name, ngmodels.ProvenanceNone)
	if err != nil {
		return old, false, err
	}

	return old, false, nil
}

func (s *legacyStorage) DeleteCollection(_ context.Context, _ rest.ValidateObjectFunc, _ *metav1.DeleteOptions, _ *internalversion.ListOptions) (runtime.Object, error) {
	// TODO: should we support this?
	return nil, k8serrors.NewMethodNotSupported(ResourceInfo.GroupResource(), "delete")
}
