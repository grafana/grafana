package user

import (
	"context"
	"fmt"
	"time"

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
	"github.com/grafana/grafana/pkg/storage/legacysql"
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

	// Resolve the incoming object to extract the lastSeenAt value from the request
	oldObj, err := s.legacy.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, false, err
	}

	newObj, err := objInfo.UpdatedObject(ctx, oldObj)
	if err != nil {
		return nil, false, err
	}

	updatedUser, ok := newObj.(*iamv0alpha1.User)
	if !ok {
		return nil, false, fmt.Errorf("expected User but got %T", newObj)
	}

	lastSeenAt := time.Unix(updatedUser.Status.LastSeenAt, 0).UTC()

	// Update lastSeenAt in the legacy store with the value from the request
	err = s.store.UpdateLastSeenAt(ctx, ns, legacy.UpdateUserLastSeenAtCommand{
		UID:        name,
		LastSeenAt: legacysql.NewDBTime(lastSeenAt),
	})
	if err != nil {
		return nil, false, err
	}

	// Re-fetch from legacy to get the authoritative state after the update
	legacyObj, err := s.legacy.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, false, err
	}
	legacyUser, ok := legacyObj.(*iamv0alpha1.User)
	if !ok {
		return nil, false, fmt.Errorf("expected User but got %T", legacyObj)
	}

	// Sync the status to unified store
	unifiedObj, err := s.status.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		logger.Warn("unable to read unified status", "error", err)
		return legacyUser, false, nil
	}
	unified, ok := unifiedObj.(*iamv0alpha1.User)
	if !ok {
		logger.Warn("unexpected type from unified status", "type", fmt.Sprintf("%T", unifiedObj))
		return legacyUser, false, nil
	}

	// FIXME: merge correctly instead of overwriting the whole status. This will cause issues if there are other fields in the status that are not managed by legacy store.
	unified.Status = legacyUser.Status

	_, _, err = s.status.Update(ctx, name, rest.DefaultUpdatedObjectInfo(unified), createValidation, updateValidation, false, options)
	if err != nil {
		logger.Warn("error updating unified status", "error", err)
	}

	return legacyUser, false, nil
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
