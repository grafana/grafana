package resourcepermission

import (
	"context"
	"encoding/json"
	"fmt"
	"iter"
	"strconv"
	"strings"
	"sync"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var (
	_ resource.StorageBackend = &ResourcePermSqlBackend{}
)

// continueToken represents pagination state for list operations
type continueToken struct {
	offset int64 // the offset for pagination
}

func readContinueToken(next string) (continueToken, error) {
	var err error
	token := continueToken{}
	if next == "" {
		return token, nil
	}
	parts := strings.Split(next, "/")
	sub := strings.Split(parts[0], ":")
	if sub[0] != "offset" {
		return token, fmt.Errorf("expected offset in continue token")
	}
	token.offset, err = strconv.ParseInt(sub[1], 10, 64)
	if err != nil {
		return token, fmt.Errorf("error parsing offset: %w", err)
	}

	return token, nil
}

func (t *continueToken) String() string {
	return fmt.Sprintf("offset:%d", t.offset)
}

// resourcePermissionListIterator implements resource.ListIterator for resource permissions
type resourcePermissionListIterator struct {
	// List of resource permissions to iterate over
	permissions []*v0alpha1.ResourcePermission
	// Current index in the permissions slice (0-based)
	idx int
	// Error encountered during iteration
	err error
	// Continue token for pagination
	token continueToken
	// List resource version
	listRV int64
}

func (r *resourcePermissionListIterator) Next() bool {
	if r.err != nil || r.idx >= len(r.permissions) {
		return false
	}

	// Move to next item
	r.idx++
	// Update continue token offset
	r.token.offset++

	return r.idx <= len(r.permissions)
}

func (r *resourcePermissionListIterator) Error() error {
	return r.err
}

func (r *resourcePermissionListIterator) ContinueToken() string {
	return r.token.String()
}

func (r *resourcePermissionListIterator) ResourceVersion() int64 {
	if r.idx == 0 || r.idx > len(r.permissions) {
		return r.listRV
	}
	// Parse resource version from the current permission's ObjectMeta
	if rv := r.permissions[r.idx-1].ObjectMeta.ResourceVersion; rv != "" {
		if parsed, err := strconv.ParseInt(rv, 10, 64); err == nil {
			return parsed
		}
	}
	return r.listRV
}

func (r *resourcePermissionListIterator) Namespace() string {
	if r.idx == 0 || r.idx > len(r.permissions) {
		return ""
	}
	return r.permissions[r.idx-1].GetNamespace()
}

func (r *resourcePermissionListIterator) Name() string {
	if r.idx == 0 || r.idx > len(r.permissions) {
		return ""
	}
	return r.permissions[r.idx-1].GetName()
}

func (r *resourcePermissionListIterator) Folder() string {
	// Resource permissions don't have folders
	return ""
}

func (r *resourcePermissionListIterator) Value() []byte {
	if r.idx == 0 || r.idx > len(r.permissions) {
		r.err = fmt.Errorf("no current permission")
		return nil
	}

	b, err := json.Marshal(r.permissions[r.idx-1])
	if err != nil {
		r.err = err
		return nil
	}
	return b
}

type ResourcePermSqlBackend struct {
	dbProvider legacysql.LegacyDatabaseProvider
	logger     log.Logger

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

func (s *ResourcePermSqlBackend) ListIterator(ctx context.Context, req *resourcepb.ListRequest, cb func(resource.ListIterator) error) (int64, error) {
	opts := req.Options
	if opts == nil || opts.Key == nil || opts.Key.Namespace == "" {
		return 0, apierrors.NewBadRequest("list requires a valid namespace")
	}

	ns, err := types.ParseNamespace(opts.Key.Namespace)
	if err != nil {
		return 0, err
	}
	if ns.OrgID <= 0 {
		return 0, apierrors.NewBadRequest("list requires a valid namespace")
	}

	if req.ResourceVersion != 0 {
		return 0, apierrors.NewBadRequest("list with explicit resourceVersion is not supported by this storage backend")
	}

	token, err := readContinueToken(req.NextPageToken)
	if err != nil {
		return 0, err
	}

	sql, err := s.dbProvider(ctx)
	if err != nil {
		s.logger.Error("Failed to get database helper", "error", err)
		return 0, ErrDatabaseHelper
	}

	// Build query for listing resource permissions
	query := &ListResourcePermissionsQuery{
		OrgID: ns.OrgID,
		ActionSets: []string{
			"dashboards:admin", "dashboards:edit", "dashboards:view",
			"folders:admin", "folders:edit", "folders:view",
		},
		Pagination: common.Pagination{
			Limit:    req.Limit,
			Continue: token.offset,
		},
	}

	permissions, err := s.listResourcePermissions(ctx, sql, query)
	if err != nil {
		return 0, fmt.Errorf("failed to list resource permissions: %w", err)
	}

	iterator := &resourcePermissionListIterator{
		permissions: permissions,
		idx:         0,
		token:       token,
		listRV:      time.Now().UnixMilli(),
	}

	err = cb(iterator)
	if err != nil {
		return 0, err
	}

	return iterator.listRV, nil
}

func (s *ResourcePermSqlBackend) ListModifiedSince(ctx context.Context, key resource.NamespacedResource, sinceRv int64) (int64, iter.Seq2[*resource.ModifiedResource, error]) {
	return 0, func(yield func(*resource.ModifiedResource, error) bool) {
		yield(nil, errNotImplemented)
	}
}

func (s *ResourcePermSqlBackend) ReadResource(ctx context.Context, req *resourcepb.ReadRequest) *resource.BackendReadResponse {
	version := int64(0)
	if req.ResourceVersion > 0 {
		version = req.ResourceVersion
	}

	rsp := &resource.BackendReadResponse{
		Key:             req.GetKey(),
		ResourceVersion: version,
	}

	sql, err := s.dbProvider(ctx)
	if err != nil {
		rsp.Error = resource.AsErrorResult(err)
		return rsp
	}

	resourcePermission, err := s.getResourcePermission(ctx, sql, req.Key.Name)
	if err != nil {
		rsp.Error = resource.AsErrorResult(err)
		return rsp
	}

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

	switch event.Type {
	default:
		return 0, fmt.Errorf("unsupported event type: %v", event.Type)
	}
}
