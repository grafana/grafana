package resourcepermission

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/grafana/authlib/types"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/extensions/licensing"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/noopstorage"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type ResourcePermissionSqlBackend struct {
	sql      legacysql.LegacyDatabaseProvider
	token    licensing.LicenseToken
	fallback *noopstorage.StorageBackendImpl

	subscribers []chan *resource.WrittenEvent
	mutex       sync.Mutex
}

func ProvideStorageBackend(sql legacysql.LegacyDatabaseProvider, token licensing.LicenseToken) *ResourcePermissionSqlBackend {
	return &ResourcePermissionSqlBackend{
		sql:      sql,
		token:    token,
		fallback: noopstorage.ProvideStorageBackend(),

		subscribers: make([]chan *resource.WrittenEvent, 0),
		mutex:       sync.Mutex{},
	}
}

func (s *ResourcePermissionSqlBackend) GetResourceStats(ctx context.Context, namespace string, minCount int) ([]resource.ResourceStats, error) {
	return nil, errors.New("not supported by this storage backend")
}

func (s *ResourcePermissionSqlBackend) ListHistory(ctx context.Context, req *resourcepb.ListRequest, cb func(resource.ListIterator) error) (int64, error) {
	return 0, errors.New("not supported by this storage backend")
}

func (s *ResourcePermissionSqlBackend) ListIterator(ctx context.Context, req *resourcepb.ListRequest, cb func(resource.ListIterator) error) (int64, error) {
	if !s.token.FeatureEnabled(licensing.FeatureAccessControl) {
		return s.fallback.ListIterator(ctx, req, cb)
	}

	if req.ResourceVersion != 0 {
		return 0, apierrors.NewBadRequest("List with explicit resourceVersion is not supported with this storage backend")
	}

	// Parse continue token
	token, err := readContinueToken(req.NextPageToken)
	if err != nil {
		return 0, fmt.Errorf("failed to parse continue token: %w", err)
	}

	// Parse namespace to get OrgID
	namespaceInfo, err := request.NamespaceInfoFrom(ctx, false)
	if err != nil {
		return 0, fmt.Errorf("failed to parse namespace: %w", err)
	}

	// Default to org 1 if no valid org ID is found
	orgID := namespaceInfo.OrgID
	if orgID < 1 {
		orgID = 1
	}

	query := &ListResourcePermissionsQuery{
		OrgID: orgID,
		Pagination: common.Pagination{
			Limit:    req.Limit,
			Continue: token.id,
		},
	}

	sql, err := s.sql(ctx)
	if err != nil {
		return 0, err
	}

	// Follow the role pattern: start with 0 and get actual version from iterator
	listRV := int64(0)
	rows, err := s.newResourcePermissionIterator(ctx, sql, query)
	if rows != nil {
		defer func() {
			_ = rows.Close()
		}()
	}
	if err == nil {
		err = cb(rows)
	}

	// Get the highest resource version after callback (like role implementation)
	if rows != nil {
		listRV = rows.listRV
	}

	return listRV, err
}

func getApiGroupForResource(resourceType string) string {
	switch resourceType {
	case "dashboards":
		return "dashboard.grafana.app"
	case "folders":
		return "folder.grafana.app"
	case "datasources":
		return "datasource.grafana.app"
	default:
		return "core.grafana.app"
	}
}

func (s *ResourcePermissionSqlBackend) ReadResource(ctx context.Context, req *resourcepb.ReadRequest) *resource.BackendReadResponse {
	if !s.token.FeatureEnabled(licensing.FeatureAccessControl) {
		return s.fallback.ReadResource(ctx, req)
	}

	version := int64(0)
	if req.ResourceVersion > 0 {
		version = req.ResourceVersion
	}

	rsp := &resource.BackendReadResponse{
		ResourceVersion: version,
	}

	sql, err := s.sql(ctx)
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

func (s *ResourcePermissionSqlBackend) WatchWriteEvents(ctx context.Context) (<-chan *resource.WrittenEvent, error) {
	stream := make(chan *resource.WrittenEvent, 10)
	{
		s.mutex.Lock()
		defer s.mutex.Unlock()

		// Add the event stream
		s.subscribers = append(s.subscribers, stream)
	}

	// Wait for context done
	go func() {
		// Wait till the context is done
		<-ctx.Done()

		// Then remove the subscription
		s.mutex.Lock()
		defer s.mutex.Unlock()

		// Copy all streams without our listener
		subs := []chan *resource.WrittenEvent{}
		for _, sub := range s.subscribers {
			if sub != stream {
				subs = append(subs, sub)
			}
		}
		s.subscribers = subs
	}()
	return stream, nil
}

func (s *ResourcePermissionSqlBackend) WriteEvent(ctx context.Context, event resource.WriteEvent) (int64, error) {
	if !s.token.FeatureEnabled(licensing.FeatureAccessControl) {
		return s.fallback.WriteEvent(ctx, event)
	}

	ns, err := types.ParseNamespace(event.Key.Namespace)
	if err != nil {
		return 0, err
	}
	if ns.OrgID <= 0 {
		return 0, apierrors.NewBadRequest("write requires a valid namespace")
	}

	if err := isResourcePermissionKey(event.Key, true); err != nil {
		return 0, apierrors.NewBadRequest(fmt.Sprintf("invalid resource permission key %q: %v", event.Key, err.Error()))
	}

	var rv int64
	switch event.Type {
	case resourcepb.WatchEvent_ADDED:
		var v0resourceperm *v0alpha1.ResourcePermission
		v0resourceperm, err = getResourcePermissionFromEvent(event)
		if err != nil {
			return 0, err
		}

		if v0resourceperm.Name != event.Key.Name {
			return 0, apierrors.NewBadRequest(
				fmt.Sprintf("resource permission name %q != %q: %v", event.Key.Name, v0resourceperm.Name, ErrNameMismatch.Error()),
			)
		}
		if v0resourceperm.Namespace != ns.Value {
			return 0, apierrors.NewBadRequest(
				fmt.Sprintf("namespace %q != %q: %v", ns.Value, v0resourceperm.Namespace, ErrNamespaceMismatch.Error()),
			)
		}

		dbHelper, err := s.sql(ctx)
		if err != nil {
			return 0, err
		}

		rv, err = s.createResourcePermission(ctx, dbHelper, ns, v0resourceperm)
		if err != nil {
			if errors.Is(err, ErrEmptyResourcePermissionName) || errors.Is(err, ErrInvalidResourcePermissionSpec) {
				return 0, apierrors.NewBadRequest(err.Error())
			}
			return 0, err
		}
	case resourcepb.WatchEvent_MODIFIED:
		// For now, treat updates the same as creates - replace all permissions
		var v0resourceperm *v0alpha1.ResourcePermission
		v0resourceperm, err = getResourcePermissionFromEvent(event)
		if err != nil {
			return 0, err
		}

		if v0resourceperm.Name != event.Key.Name {
			return 0, apierrors.NewBadRequest(
				fmt.Sprintf("resource permission name %q != %q: %v", event.Key.Name, v0resourceperm.Name, ErrNameMismatch.Error()),
			)
		}
		if v0resourceperm.Namespace != ns.Value {
			return 0, apierrors.NewBadRequest(
				fmt.Sprintf("namespace %q != %q: %v", ns.Value, v0resourceperm.Namespace, ErrNamespaceMismatch.Error()),
			)
		}

		dbHelper, err := s.sql(ctx)
		if err != nil {
			return 0, err
		}

		// For now, use the same create method - this could be optimized later with proper update logic
		rv, err = s.createResourcePermission(ctx, dbHelper, ns, v0resourceperm)
		if err != nil {
			if errors.Is(err, ErrEmptyResourcePermissionName) || errors.Is(err, ErrInvalidResourcePermissionSpec) {
				return 0, apierrors.NewBadRequest(err.Error())
			}
			return 0, err
		}
	case resourcepb.WatchEvent_DELETED:
		// TODO: Implement proper deletion logic
		// For now, just return success with a timestamp
		rv = int64(time.Now().UnixMilli())
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
			s.mutex.Lock()
			defer s.mutex.Unlock()
			for _, sub := range s.subscribers {
				sub <- write
			}
		}()
	}
	return rv, nil
}

func isResourcePermissionKey(key *resourcepb.ResourceKey, requireName bool) error {
	gr := v0alpha1.ResourcePermissionInfo.GroupResource()
	if key.Group != gr.Group {
		return fmt.Errorf("expecting resource permission group (%s != %s)", key.Group, gr.Group)
	}
	if key.Resource != gr.Resource {
		return fmt.Errorf("expecting resource permission resource (%s != %s)", key.Resource, gr.Resource)
	}
	if requireName && key.Name == "" {
		return fmt.Errorf("expecting resource permission name")
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

func (s *ResourcePermissionSqlBackend) convertToV0Alpha1ResourcePermission(perm accesscontrol.ResourcePermission) *v0alpha1.ResourcePermission {
	var kind v0alpha1.ResourcePermissionSpecPermissionKind
	var name string

	if perm.UserID != 0 {
		kind = v0alpha1.ResourcePermissionSpecPermissionKindUser
		name = perm.UserUID
	} else if perm.TeamID != 0 {
		kind = v0alpha1.ResourcePermissionSpecPermissionKindTeam
		name = perm.TeamUID
	} else if perm.BuiltInRole != "" {
		kind = v0alpha1.ResourcePermissionSpecPermissionKindBasicRole
		name = perm.BuiltInRole
	} else {
		kind = v0alpha1.ResourcePermissionSpecPermissionKindUser
		name = "unknown"
	}

	permissions := []v0alpha1.ResourcePermissionspecPermission{
		{
			Kind:  kind,
			Name:  name,
			Verbs: perm.Actions,
		},
	}

	resource := "unknown"
	resourceName := "*"
	if perm.Scope != "" {
		parts := strings.Split(perm.Scope, ":")
		if len(parts) >= 1 {
			resource = parts[0]
		}
		if len(parts) >= 3 {
			resourceName = parts[2]
		}
	}

	return &v0alpha1.ResourcePermission{
		ObjectMeta: metav1.ObjectMeta{
			Name: fmt.Sprintf("perm-%d", perm.ID),
		},
		Spec: v0alpha1.ResourcePermissionSpec{
			Resource: v0alpha1.ResourcePermissionspecResource{
				ApiGroup: getApiGroupForResource(resource),
				Resource: resource,
				Name:     resourceName,
			},
			Permissions: permissions,
		},
	}
}

type listIteratorFromSlice struct {
	items [][]byte
	index int
}

func (l *listIteratorFromSlice) Next() bool {
	return l.index < len(l.items)
}

func (l *listIteratorFromSlice) Error() error {
	return nil
}

func (l *listIteratorFromSlice) Value() []byte {
	if l.index >= len(l.items) {
		return nil
	}
	item := l.items[l.index]
	l.index++
	return item
}

func (l *listIteratorFromSlice) Close() error {
	return nil
}

func (l *listIteratorFromSlice) ContinueToken() string {
	return ""
}

func (l *listIteratorFromSlice) Folder() string {
	return ""
}

func (l *listIteratorFromSlice) Name() string {
	return ""
}

func (l *listIteratorFromSlice) Namespace() string {
	return ""
}

func (l *listIteratorFromSlice) ResourceVersion() int64 {
	return 0
}

func stringPtr(s string) *string {
	return &s
}
