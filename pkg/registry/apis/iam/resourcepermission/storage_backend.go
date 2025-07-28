package resourcepermission

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"

	"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/extensions/licensing"
	"github.com/grafana/grafana/pkg/registry/apis/iam/noopstorage"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type ResourcePermissionSqlBackend struct {
	rpService resourcepermissions.Store
	service   resourcepermissions.Service
	sql       legacysql.LegacyDatabaseProvider
	token     licensing.LicenseToken
	fallback  *noopstorage.StorageBackendImpl

	subscribers []chan *resource.WrittenEvent
	mutex       sync.Mutex
}

func ProvideStorageBackend(rpService resourcepermissions.Store, sql legacysql.LegacyDatabaseProvider, token licensing.LicenseToken) *ResourcePermissionSqlBackend {
	return &ResourcePermissionSqlBackend{
		rpService: rpService,
		sql:       sql,
		token:     token,
		fallback:  noopstorage.ProvideStorageBackend(),

		subscribers: make([]chan *resource.WrittenEvent, 0),
		mutex:       sync.Mutex{},
	}
}

func ProvideStorageBackendWithService(service resourcepermissions.Service, sql legacysql.LegacyDatabaseProvider, token licensing.LicenseToken) *ResourcePermissionSqlBackend {
	return &ResourcePermissionSqlBackend{
		service:  service,
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

	dashboardPermissions := []*v0alpha1.ResourcePermission{
		{
			ObjectMeta: metav1.ObjectMeta{Name: "admin-dashboards"},
			Spec: v0alpha1.ResourcePermissionSpec{
				Resource: v0alpha1.ResourcePermissionspecResource{
					ApiGroup: "dashboard.grafana.app",
					Resource: "dashboards",
					Name:     "*",
				},
				Permissions: []v0alpha1.ResourcePermissionspecPermission{
					{
						Kind:  v0alpha1.ResourcePermissionSpecPermissionKindBasicRole,
						Name:  "admin",
						Verbs: []string{"read", "write", "create", "delete"},
					},
				},
			},
		},
		{
			ObjectMeta: metav1.ObjectMeta{Name: "editor-dashboards"},
			Spec: v0alpha1.ResourcePermissionSpec{
				Resource: v0alpha1.ResourcePermissionspecResource{
					ApiGroup: "dashboard.grafana.app",
					Resource: "dashboards",
					Name:     "*",
				},
				Permissions: []v0alpha1.ResourcePermissionspecPermission{
					{
						Kind:  v0alpha1.ResourcePermissionSpecPermissionKindBasicRole,
						Name:  "editor",
						Verbs: []string{"read", "write"},
					},
				},
			},
		},
		{
			ObjectMeta: metav1.ObjectMeta{Name: "viewer-dashboards"},
			Spec: v0alpha1.ResourcePermissionSpec{
				Resource: v0alpha1.ResourcePermissionspecResource{
					ApiGroup: "dashboard.grafana.app",
					Resource: "dashboards",
					Name:     "*",
				},
				Permissions: []v0alpha1.ResourcePermissionspecPermission{
					{
						Kind:  v0alpha1.ResourcePermissionSpecPermissionKindBasicRole,
						Name:  "viewer",
						Verbs: []string{"read"},
					},
				},
			},
		},
	}

	items := make([][]byte, 0, len(dashboardPermissions))
	for _, perm := range dashboardPermissions {
		data, err := json.Marshal(perm)
		if err != nil {
			return 0, err
		}
		items = append(items, data)
	}

	iterator := &listIteratorFromSlice{items: items, index: 0}
	err := cb(iterator)
	return 1000, err // Return some resource version
}

func (s *ResourcePermissionSqlBackend) listWithService(ctx context.Context, req *resourcepb.ListRequest, cb func(resource.ListIterator) error, token *continueToken) (int64, error) {
	items := make([][]byte, 0)
	iterator := &listIteratorFromSlice{items: items, index: 0}
	err := cb(iterator)
	return 1000, err
}

func (s *ResourcePermissionSqlBackend) listWithFallback(ctx context.Context, req *resourcepb.ListRequest, cb func(resource.ListIterator) error, token *continueToken) (int64, error) {
	items := make([][]byte, 0)
	rows := &listIteratorFromSlice{items: items, index: 0}
	err := cb(rows)
	return 1000, err
}

func (s *ResourcePermissionSqlBackend) listWithRpService(ctx context.Context, req *resourcepb.ListRequest, cb func(resource.ListIterator) error, token *continueToken) (int64, error) {
	orgID := int64(1)

	permissions, err := s.rpService.GetResourcePermissions(ctx, orgID, resourcepermissions.GetResourcePermissionsQuery{})
	if err != nil {
		return 0, err
	}

	// Convert to v0alpha1.ResourcePermission format for the API
	items := make([][]byte, 0, len(permissions))
	for _, perm := range permissions {
		v0alpha1Perm := s.convertManagedPermissionToV0Alpha1(perm)

		data, err := json.Marshal(v0alpha1Perm)
		if err != nil {
			return 0, err
		}

		items = append(items, data)
	}

	// Create iterator from our items
	rows := &listIteratorFromSlice{items: items, index: 0}
	err = cb(rows)
	return 1000, err // Return some resource version
}

func (s *ResourcePermissionSqlBackend) convertManagedPermissionToV0Alpha1(perm accesscontrol.ResourcePermission) *v0alpha1.ResourcePermission {
	return &v0alpha1.ResourcePermission{
		ObjectMeta: metav1.ObjectMeta{
			Name: fmt.Sprintf("%s-%d", perm.RoleName, perm.UserID),
		},
		Spec: v0alpha1.ResourcePermissionSpec{},
	}
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

	rsp.Error = resource.AsErrorResult(errors.New("resource permission not found"))
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

func (s *ResourcePermissionSqlBackend) WriteEvent(context.Context, resource.WriteEvent) (int64, error) {
	return 0, errors.New("not supported by this storage backend")
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
