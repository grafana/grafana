package resourcepermission

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"iter"
	"net/http"
	"sync"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var (
	_ resource.StorageBackend = &ResourcePermSqlBackend{}
)

type ResourcePermSqlBackend struct {
	dbProvider    legacysql.LegacyDatabaseProvider
	identityStore legacy.LegacyIdentityStore
	logger        log.Logger

	subscribers []chan *resource.WrittenEvent
	mutex       sync.Mutex
}

func ProvideStorageBackend(dbProvider legacysql.LegacyDatabaseProvider) *ResourcePermSqlBackend {
	return &ResourcePermSqlBackend{
		dbProvider: dbProvider,
		logger:     log.New("resourceperm_storage_backend"),

		subscribers: make([]chan *resource.WrittenEvent, 0),
		mutex:       sync.Mutex{},
	}
}

func (s *ResourcePermSqlBackend) GetResourceStats(ctx context.Context, namespace string, minCount int) ([]resource.ResourceStats, error) {
	return []resource.ResourceStats{}, errNotImplemented
}

func (s *ResourcePermSqlBackend) ListHistory(context.Context, *resourcepb.ListRequest, func(resource.ListIterator) error) (int64, error) {
	return 0, errNotImplemented
}

func (s *ResourcePermSqlBackend) ListIterator(context.Context, *resourcepb.ListRequest, func(resource.ListIterator) error) (int64, error) {
	return 0, errNotImplemented
}

func (s *ResourcePermSqlBackend) ListModifiedSince(ctx context.Context, key resource.NamespacedResource, sinceRv int64) (int64, iter.Seq2[*resource.ModifiedResource, error]) {
	return 0, func(yield func(*resource.ModifiedResource, error) bool) {
		yield(nil, errNotImplemented)
	}
}

func (s *ResourcePermSqlBackend) ReadResource(_ context.Context, req *resourcepb.ReadRequest) *resource.BackendReadResponse {
	return &resource.BackendReadResponse{
		Key:   req.GetKey(),
		Error: &resourcepb.ErrorResult{Code: http.StatusForbidden, Message: errNotImplemented.Error()},
	}
}

func (s *ResourcePermSqlBackend) WatchWriteEvents(ctx context.Context) (<-chan *resource.WrittenEvent, error) {
	stream := make(chan *resource.WrittenEvent, 10)
	return stream, nil
}

func isValidKey(key *resourcepb.ResourceKey, requireName bool) error {
	gr := v0alpha1.ResourcePermissionInfo.GroupResource()
	if key.Group != gr.Group {
		return fmt.Errorf("expecting group (%s != %s)", key.Group, gr.Group)
	}
	if key.Resource != gr.Resource {
		return fmt.Errorf("expecting resource (%s != %s)", key.Resource, gr.Resource)
	}
	if requireName && key.Name == "" {
		return fmt.Errorf("expecting name (uid): %w", errEmptyName)
	}
	return nil
}

func getResourcePermissionFromEvent(event resource.WriteEvent) (*v0alpha1.ResourcePermission, error) {
	obj, ok := event.Object.GetRuntimeObject()
	if ok && obj != nil {
		resourcePermission, ok := obj.(*v0alpha1.ResourcePermission)
		if ok {
			return resourcePermission, nil
		}
	}
	resourcePermission := &v0alpha1.ResourcePermission{}
	err := json.Unmarshal(event.Value, resourcePermission)
	return resourcePermission, err
}

func (s *ResourcePermSqlBackend) WriteEvent(ctx context.Context, event resource.WriteEvent) (rv int64, err error) {
	ns, err := types.ParseNamespace(event.Key.Namespace)
	if err != nil {
		return 0, err
	}
	if ns.OrgID <= 0 {
		return 0, apierrors.NewBadRequest("write requires a valid namespace")
	}

	if err := isValidKey(event.Key, true); err != nil {
		return 0, apierrors.NewBadRequest(fmt.Sprintf("invalid key %q: %v", event.Key, err.Error()))
	}

	switch event.Type {
	case resourcepb.WatchEvent_ADDED:
		{
			var v0resourceperm *v0alpha1.ResourcePermission
			v0resourceperm, err = getResourcePermissionFromEvent(event)
			if err != nil {
				return 0, err
			}

			if v0resourceperm.Name != event.Key.Name {
				return 0, apierrors.NewBadRequest(
					fmt.Sprintf("resource permission name %q != %q: %v", event.Key.Name, v0resourceperm.Name, errNameMismatch.Error()),
				)
			}
			if v0resourceperm.Namespace != ns.Value {
				return 0, apierrors.NewBadRequest(
					fmt.Sprintf("namespace %q != %q: %v", ns.Value, v0resourceperm.Namespace, errNamespaceMismatch.Error()),
				)
			}

			dbHelper, err := s.dbProvider(ctx)
			if err != nil {
				return 0, err
			}

			rv, err = s.createResourcePermission(ctx, dbHelper, ns, v0resourceperm)
			if err != nil {
				if errors.Is(err, errInvalidSpec) {
					return 0, apierrors.NewBadRequest(err.Error())
				}
				return 0, err
			}
		}
	default:
		return 0, fmt.Errorf("unsupported event type: %v", event.Type)
	}

	// Async notify all subscribers (not HA!!!)
	if s.subscribers != nil {
		go func() {
			write := &resource.WrittenEvent{
				Type:       event.Type,
				Key:        event.Key,
				PreviousRV: event.PreviousRV,
				Value:      event.Value,

				Timestamp:       time.Now().UnixMilli(),
				ResourceVersion: rv,
			}
			for _, sub := range s.subscribers {
				sub <- write
			}
		}()
	}
	return rv, nil
}
