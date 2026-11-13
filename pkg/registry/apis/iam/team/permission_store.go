package team

import (
	"context"
	"fmt"
	"strconv"

	"github.com/grafana/authlib/types"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/registry/rest"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer/storewrapper"
)

// NewPermissionStore protects membership fields outside the dual writer so the
// same checks apply to legacy and unified storage without redacting replicated data.
func NewPermissionStore(storage rest.Storage, accessClient types.AccessClient, options ...storewrapper.Option) (rest.Storage, error) {
	inner, ok := storage.(storewrapper.K8sStorage)
	if !ok {
		return nil, fmt.Errorf("team storage %T does not implement the expected interface set", storage)
	}
	permissions := &membershipPermissions{accessClient: accessClient}
	options = append(options, storewrapper.WithPreserveIdentity())
	return &permissionStore{
		Wrapper:     storewrapper.New(inner, teamResource.GroupResource(), permissions, options...),
		permissions: permissions,
	}, nil
}

type permissionStore struct {
	*storewrapper.Wrapper
	permissions *membershipPermissions
}

func (s *permissionStore) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	obj, err := s.Wrapper.Get(ctx, name, options)
	if err != nil {
		return nil, err
	}
	return s.permissions.redact(ctx, obj)
}

func (s *permissionStore) Create(ctx context.Context, obj runtime.Object, validation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	result, err := s.Wrapper.Create(ctx, obj, validation, options)
	if err != nil {
		return nil, err
	}
	return s.permissions.redact(ctx, result)
}

func (s *permissionStore) Update(ctx context.Context, name string, info rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	result, created, err := s.Wrapper.Update(ctx, name, info, createValidation, updateValidation, forceAllowCreate, options)
	if err != nil {
		return nil, created, err
	}
	result, err = s.permissions.redact(ctx, result)
	return result, created, err
}

func (s *permissionStore) Delete(ctx context.Context, name string, validation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	result, deleted, err := s.Wrapper.Delete(ctx, name, validation, options)
	if err != nil {
		return nil, deleted, err
	}
	if _, ok := result.(*iamv0.Team); !ok {
		return result, deleted, nil
	}
	result, err = s.permissions.redact(ctx, result)
	return result, deleted, err
}

var (
	_ storewrapper.K8sStorage                = (*permissionStore)(nil)
	_ rest.Watcher                           = (*permissionStore)(nil)
	_ storewrapper.ResourceStorageAuthorizer = (*membershipPermissions)(nil)
)

type membershipPermissions struct {
	storewrapper.NoopAuthorizer
	accessClient types.AccessClient
}

func (p *membershipPermissions) check(ctx context.Context, obj *iamv0.Team, verb string) (bool, error) {
	ident, err := identity.GetRequester(ctx)
	if err != nil {
		return false, apierrors.NewUnauthorized("no identity found")
	}
	namespace := obj.Namespace
	if namespace == "" {
		namespace = ident.GetNamespace()
	}
	result, err := p.accessClient.Check(ctx, ident, types.CheckRequest{
		Group:     teamResource.GroupResource().Group,
		Resource:  teamResource.GetName(),
		Namespace: namespace,
		Name:      obj.Name,
		Verb:      verb,
	}, "")
	return result.Allowed, err
}

func (p *membershipPermissions) BeforeCreate(ctx context.Context, obj runtime.Object) error {
	return p.BeforeUpdate(ctx, &iamv0.Team{}, obj)
}

func (p *membershipPermissions) BeforeUpdate(ctx context.Context, oldObj, obj runtime.Object) error {
	old, ok := oldObj.(*iamv0.Team)
	if !ok {
		return apierrors.NewInternalError(fmt.Errorf("expected Team, got %T", oldObj))
	}
	updated, ok := obj.(*iamv0.Team)
	if !ok {
		return apierrors.NewInternalError(fmt.Errorf("expected Team, got %T", obj))
	}
	if equalUnordered(old.Spec.Members, updated.Spec.Members) && equalUnordered(old.Spec.ExternalGroups, updated.Spec.ExternalGroups) {
		return nil
	}
	allowed, err := p.check(ctx, updated, utils.VerbSetPermissions)
	if err != nil {
		return err
	}
	if !allowed {
		return apierrors.NewForbidden(teamResource.GroupResource(), updated.Name, fmt.Errorf("requires team setpermissions to change membership or external groups"))
	}
	return nil
}

func equalUnordered[T comparable](a, b []T) bool {
	if len(a) != len(b) {
		return false
	}
	counts := make(map[T]int, len(a))
	for _, value := range a {
		counts[value]++
	}
	for _, value := range b {
		if counts[value] == 0 {
			return false
		}
		counts[value]--
	}
	return true
}

func (p *membershipPermissions) redact(ctx context.Context, obj runtime.Object) (runtime.Object, error) {
	team, ok := obj.(*iamv0.Team)
	if !ok {
		return nil, apierrors.NewInternalError(fmt.Errorf("expected Team, got %T", obj))
	}
	allowed, err := p.check(ctx, team, utils.VerbGetPermissions)
	if err != nil {
		return nil, err
	}
	result := team.DeepCopy()
	if !allowed {
		result.Spec.Members = nil
		result.Spec.ExternalGroups = nil
	}
	return result, nil
}

func (p *membershipPermissions) FilterList(ctx context.Context, obj runtime.Object) (runtime.Object, error) {
	list, ok := obj.(*iamv0.TeamList)
	if !ok {
		return nil, apierrors.NewInternalError(fmt.Errorf("expected TeamList, got %T", obj))
	}
	result := list.DeepCopy()
	teams := make([]*iamv0.Team, len(result.Items))
	for i := range result.Items {
		teams[i] = &result.Items[i]
	}
	if err := p.redactBatch(ctx, teams); err != nil {
		return nil, err
	}
	return result, nil
}

// redactBatch receives response copies so redaction never modifies stored objects.
func (p *membershipPermissions) redactBatch(ctx context.Context, teams []*iamv0.Team) error {
	if len(teams) == 0 {
		return nil
	}
	ident, err := identity.GetRequester(ctx)
	if err != nil {
		return apierrors.NewUnauthorized("no identity found")
	}
	namespace := teams[0].Namespace
	if namespace == "" {
		namespace = ident.GetNamespace()
	}
	checks := make([]types.BatchCheckItem, len(teams))
	for i, team := range teams {
		if team.Namespace != "" && team.Namespace != namespace {
			return apierrors.NewInternalError(fmt.Errorf("team response spans multiple namespaces"))
		}
		checks[i] = types.BatchCheckItem{
			CorrelationID: strconv.Itoa(i),
			Group:         teamResource.GroupResource().Group,
			Resource:      teamResource.GetName(),
			Name:          team.Name,
			Verb:          utils.VerbGetPermissions,
		}
	}
	for start := 0; start < len(checks); start += types.MaxBatchCheckItems {
		end := min(start+types.MaxBatchCheckItems, len(checks))
		result, err := p.accessClient.BatchCheck(ctx, ident, types.BatchCheckRequest{
			Namespace: namespace,
			Checks:    checks[start:end],
		})
		if err != nil {
			return err
		}
		for i := start; i < end; i++ {
			if !result.Results[strconv.Itoa(i)].Allowed {
				teams[i].Spec.Members = nil
				teams[i].Spec.ExternalGroups = nil
			}
		}
	}
	return nil
}

func (p *membershipPermissions) WatchFilter(ctx context.Context) (storewrapper.WatchEventFilter, error) {
	return func(events []watch.Event) ([]bool, error) {
		teams := make([]*iamv0.Team, len(events))
		for i := range events {
			obj, ok := events[i].Object.(*iamv0.Team)
			if !ok {
				return nil, apierrors.NewInternalError(fmt.Errorf("expected Team, got %T", events[i].Object))
			}
			teams[i] = obj.DeepCopy()
		}
		if err := p.redactBatch(ctx, teams); err != nil {
			return nil, err
		}
		allowed := make([]bool, len(events))
		for i := range events {
			events[i].Object = teams[i]
			allowed[i] = true
		}
		return allowed, nil
	}, nil
}
