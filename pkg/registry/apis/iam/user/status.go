package user

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"
	"sigs.k8s.io/structured-merge-diff/v6/fieldpath"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

// unifiedStatusStorage is the subset of StatusREST used by statusDualWriter.
type unifiedStatusStorage interface {
	rest.Patcher
}

type statusDualWriter struct {
	gv     schema.GroupVersion
	status unifiedStatusStorage
	legacy *LegacyStore
	store  legacy.LegacyIdentityStore
}

var (
	_ rest.Patcher             = (*statusDualWriter)(nil)
	_ rest.Storage             = (*statusDualWriter)(nil)
	_ rest.ResetFieldsStrategy = (*statusDualWriter)(nil)
)

func NewStatusDualWriter(store legacy.LegacyIdentityStore, legacyStore *LegacyStore, unified *grafanaregistry.StatusREST) *statusDualWriter {
	gvr := iamv0alpha1.UserResourceInfo.GroupVersionResource()
	return &statusDualWriter{
		gv:     gvr.GroupVersion(),
		status: unified,
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
func (s *statusDualWriter) Get(ctx context.Context, name string, options *v1.GetOptions) (runtime.Object, error) {
	return s.legacy.Get(ctx, name, options)
}

// Update implements rest.Patcher.
func (s *statusDualWriter) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *v1.UpdateOptions) (runtime.Object, bool, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}

	now := time.Now()
	if err := s.store.UpdateUserLastSeenAt(ctx, ns, name, now); err != nil {
		return nil, false, err
	}

	legacyObj, err := s.legacy.Get(ctx, name, &v1.GetOptions{})
	if err != nil {
		return nil, false, err
	}

	// Sync to unified storage — best effort.
	unifiedObj, err := s.status.Get(ctx, name, &v1.GetOptions{})
	if err != nil {
		logging.FromContext(ctx).Warn("unable to read unified user status", "error", err)
		return legacyObj, false, nil
	}

	unified, ok := unifiedObj.(*iamv0alpha1.User)
	if !ok {
		logging.FromContext(ctx).Warn("unexpected unified object type", "type", fmt.Sprintf("%T", unifiedObj))
		return legacyObj, false, nil
	}

	unified.Status.LastSeenAt = now.UnixMilli()

	_, _, err = s.status.Update(ctx, name, rest.DefaultUpdatedObjectInfo(unified), createValidation, updateValidation, false, options)
	if err != nil {
		logging.FromContext(ctx).Warn("error updating unified user status", "error", err)
	}

	return legacyObj, false, nil
}

// GetResetFields implements rest.ResetFieldsStrategy.
func (s *statusDualWriter) GetResetFields() map[fieldpath.APIVersion]*fieldpath.Set {
	return map[fieldpath.APIVersion]*fieldpath.Set{
		fieldpath.APIVersion(s.gv.String()): fieldpath.NewSet(
			fieldpath.MakePathOrDie("spec"),
			fieldpath.MakePathOrDie("metadata"),
		),
	}
}
