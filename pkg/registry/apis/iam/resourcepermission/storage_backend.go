package resourcepermission

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"iter"
	"sync"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var (
	_ resource.StorageBackend = &ResourcePermSqlBackend{}
)

type ResourcePermSqlBackend struct {
	dbProvider legacysql.LegacyDatabaseProvider
	logger     log.Logger

	mappers        map[schema.GroupResource]Mapper // group/resource -> rbac mapper
	reverseMappers map[string]schema.GroupResource // rbac kind -> group/resource

	subscribers []chan *resource.WrittenEvent
	mutex       sync.Mutex
}

func ProvideStorageBackend(dbProvider legacysql.LegacyDatabaseProvider) *ResourcePermSqlBackend {
	return &ResourcePermSqlBackend{
		dbProvider: dbProvider,
		logger:     log.New("resourceperm_storage_backend"),

		mappers: map[schema.GroupResource]Mapper{
			{Group: "folder.grafana.app", Resource: "folders"}:       NewMapper("folders", defaultLevels),
			{Group: "dashboard.grafana.app", Resource: "dashboards"}: NewMapper("dashboards", defaultLevels),
		},
		reverseMappers: map[string]schema.GroupResource{
			"folders":    {Group: "folder.grafana.app", Resource: "folders"},
			"dashboards": {Group: "dashboard.grafana.app", Resource: "dashboards"},
		},

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

func (s *ResourcePermSqlBackend) ReadResource(ctx context.Context, req *resourcepb.ReadRequest) *resource.BackendReadResponse {
	rsp := &resource.BackendReadResponse{Key: req.GetKey()}

	ns, err := types.ParseNamespace(req.Key.Namespace)
	if err != nil {
		rsp.Error = resource.AsErrorResult(err)
		return rsp
	}
	if ns.OrgID <= 0 {
		rsp.Error = resource.AsErrorResult(apierrors.NewBadRequest(errInvalidNamespace.Error()))
		return rsp
	}

	if req.ResourceVersion > 0 {
		rsp.Error = resource.AsErrorResult(apierrors.NewBadRequest("resourceVersion is not supported"))
		return rsp
	}

	dbHelper, err := s.dbProvider(ctx)
	if err != nil {
		// Hide the error from the user, but log it
		logger := s.logger.FromContext(ctx)
		logger.Error("Failed to get database helper", "error", err)
		rsp.Error = resource.AsErrorResult(errDatabaseHelper)
		return rsp
	}

	resourcePermission, err := s.getResourcePermission(ctx, dbHelper, ns, req.Key.Name)
	if err != nil {
		if errors.Is(err, errNotFound) {
			rsp.Error = resource.AsErrorResult(
				apierrors.NewNotFound(v0alpha1.ResourcePermissionInfo.GroupResource(), req.Key.Name),
			)
		} else if errors.Is(err, errUnknownGroupResource) || errors.Is(err, errInvalidName) {
			rsp.Error = resource.AsErrorResult(apierrors.NewBadRequest(err.Error()))
		} else {
			rsp.Error = resource.AsErrorResult(err)
		}
		return rsp
	}

	rsp.ResourceVersion = resourcePermission.GetUpdateTimestamp().UnixMilli()
	rsp.Value, err = json.Marshal(resourcePermission)
	if err != nil {
		rsp.Error = resource.AsErrorResult(err)
		return rsp
	}

	return rsp
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

	dbHelper, err := s.dbProvider(ctx)
	if err != nil {
		// Hide the error from the user, but log it
		logger := s.logger.FromContext(ctx)
		logger.Error("Failed to get database helper", "error", err)
		return 0, err
	}

	switch event.Type {
	case resourcepb.WatchEvent_DELETED:
		err = s.deleteResourcePermission(ctx, dbHelper, ns, event.Key.Name)
	default:
		return 0, fmt.Errorf("unsupported event type: %v", event.Type)
	}

	return rv, err
}
