package user

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"
	"sigs.k8s.io/structured-merge-diff/v6/fieldpath"

	"github.com/grafana/grafana/pkg/infra/log"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

var logger = log.New("iam.user.status")

type statusDualWriter struct {
	gv     schema.GroupVersion
	status *grafanaregistry.StatusREST
	legacy *LegacyStore
	store  legacy.LegacyIdentityStore
}

var (
	_ rest.Patcher             = (*statusDualWriter)(nil)
	_ rest.Storage             = (*statusDualWriter)(nil)
	_ rest.ResetFieldsStrategy = (*statusDualWriter)(nil)
)

func NewStatusDualWriter(gv schema.GroupVersion, status *grafanaregistry.StatusREST, legacyStore *LegacyStore, store legacy.LegacyIdentityStore) rest.Storage {
	return &statusDualWriter{
		gv:     gv,
		status: status,
		legacy: legacyStore,
		store:  store,
	}
}

// Destroy implements rest.Storage.
func (s *statusDualWriter) Destroy() {}

// New implements rest.Storage.
func (s *statusDualWriter) New() runtime.Object {
	return s.legacy.New()
}

// Get implements rest.Patcher.
func (s *statusDualWriter) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	return s.legacy.Get(ctx, name, options)
}

// Update implements rest.Patcher.
func (s *statusDualWriter) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}

	// Update lastSeenAt in the legacy store
	err = s.store.UpdateLastSeenAt(ctx, ns, legacy.UpdateUserLastSeenAtCommand{
		UID: name,
	})
	if err != nil {
		return nil, false, err
	}

	getter := func(getter rest.Getter) (*iamv0alpha1.User, error) {
		obj, err := getter.Get(ctx, name, &metav1.GetOptions{})
		if err != nil {
			return nil, err
		}
		val, ok := obj.(*iamv0alpha1.User)
		if !ok {
			return nil, fmt.Errorf("expected User but got %T", obj)
		}
		return val, nil
	}

	legacyObj, err := getter(s.legacy)
	if err != nil {
		return nil, false, err
	}

	unified, err := getter(s.status)
	if err != nil {
		logger.Warn("unable to read unified status", "error", err)
		return legacyObj, false, nil
	}

	// Use the same status from legacy in unified
	unified.Status = legacyObj.Status

	_, _, err = s.status.Update(ctx, name, rest.DefaultUpdatedObjectInfo(unified), createValidation, updateValidation, false, options)
	if err != nil {
		logger.Warn("error updating unified status", "error", err)
	}

	return legacyObj, false, nil
}

// GetResetFields implements rest.ResetFieldsStrategy.
func (s *statusDualWriter) GetResetFields() map[fieldpath.APIVersion]*fieldpath.Set {
	fields := map[fieldpath.APIVersion]*fieldpath.Set{
		fieldpath.APIVersion(s.gv.String()): fieldpath.NewSet(
			fieldpath.MakePathOrDie("spec"),
			fieldpath.MakePathOrDie("metadata"),
		),
	}
	return fields
}
