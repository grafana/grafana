package user

import (
	"context"
	"fmt"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
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

type statusDualWriter struct {
	gv     schema.GroupVersion
	logger log.Logger
	tracer trace.Tracer
	status *grafanaregistry.StatusREST
	legacy *LegacyStore
	store  legacy.LegacyIdentityStore
}

var (
	_ rest.Patcher             = (*statusDualWriter)(nil)
	_ rest.Storage             = (*statusDualWriter)(nil)
	_ rest.ResetFieldsStrategy = (*statusDualWriter)(nil)
)

func NewStatusDualWriter(gv schema.GroupVersion, tracer trace.Tracer, status *grafanaregistry.StatusREST, legacyStore *LegacyStore, store legacy.LegacyIdentityStore) *statusDualWriter {
	return &statusDualWriter{
		gv:     gv,
		logger: log.New("grafana-apiserver.users.legacy.status"),
		tracer: tracer,
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
	ctx, span := s.tracer.Start(ctx, "user.status.get", trace.WithAttributes(
		attribute.String("name", name),
	))
	defer span.End()

	obj, err := s.legacy.Get(ctx, name, options)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "user status get failed")
	}
	return obj, err
}

// Update implements rest.Patcher.
func (s *statusDualWriter) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	ctx, span := s.tracer.Start(ctx, "user.status.update", trace.WithAttributes(
		attribute.String("name", name),
	))
	defer span.End()

	ctxLogger := s.logger.FromContext(ctx)

	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to get namespace info")
		return nil, false, err
	}

	getUser := func(getter rest.Getter) (*iamv0alpha1.User, error) {
		obj, err := getter.Get(ctx, name, &metav1.GetOptions{})
		if err != nil {
			return nil, err
		}
		u, ok := obj.(*iamv0alpha1.User)
		if !ok {
			return nil, fmt.Errorf("expected User but got %T", obj)
		}
		return u, nil
	}

	// Resolve the incoming object to extract the lastSeenAt value from the request
	oldObj, err := s.legacy.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to get user from legacy store")
		return nil, false, err
	}

	newObj, err := objInfo.UpdatedObject(ctx, oldObj)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to resolve updated object")
		return nil, false, err
	}

	updatedUser, ok := newObj.(*iamv0alpha1.User)
	if !ok {
		err := fmt.Errorf("expected User but got %T", newObj)
		span.RecordError(err)
		span.SetStatus(codes.Error, "unexpected object type")
		return nil, false, err
	}

	lastSeenAt := time.Unix(updatedUser.Status.LastSeenAt, 0).UTC()

	// Update lastSeenAt in the legacy store with the value from the request
	err = s.store.UpdateLastSeenAt(ctx, ns, legacy.UpdateUserLastSeenAtCommand{
		UID:        name,
		LastSeenAt: legacysql.NewDBTime(lastSeenAt),
	})
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to update lastSeenAt in legacy store")
		return nil, false, err
	}

	// Re-fetch from legacy to get the authoritative state after the update
	legacyUser, err := getUser(s.legacy)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to re-fetch user from legacy store")
		return nil, false, err
	}

	unified, err := getUser(s.status)
	if err != nil {
		ctxLogger.Warn("unable to read unified status", "error", err)
		return legacyUser, false, nil
	}

	// Only sync the field managed by the legacy store; preserve other status fields (e.g. TeamSync).
	unified.Status.LastSeenAt = legacyUser.Status.LastSeenAt

	_, _, err = s.status.Update(ctx, name, rest.DefaultUpdatedObjectInfo(unified), createValidation, updateValidation, false, options)
	if err != nil {
		ctxLogger.Warn("error updating unified status", "error", err)
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
