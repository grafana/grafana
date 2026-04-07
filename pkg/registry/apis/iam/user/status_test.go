package user

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	claims "github.com/grafana/authlib/types"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
)

func TestStatusDualWriter_Get(t *testing.T) {
	const uid = "user-abc"

	tests := []struct {
		name       string
		storeUsers map[string]*common.UserWithRole
		uid        string
		wantErr    bool
		wantUID    string
	}{
		{
			name:       "returns user from legacy store",
			storeUsers: map[string]*common.UserWithRole{uid: makeTestUser(uid)},
			uid:        uid,
			wantErr:    false,
			wantUID:    uid,
		},
		{
			name:       "not found returns error",
			storeUsers: map[string]*common.UserWithRole{},
			uid:        "nonexistent",
			wantErr:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := &fakeStatusLegacyStore{users: tt.storeUsers}
			w := newTestStatusWriter(store, &fakeUnifiedStatus{})

			obj, err := w.Get(namespaceContext(), tt.uid, &v1.GetOptions{})

			if tt.wantErr {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			u, ok := obj.(*iamv0alpha1.User)
			require.True(t, ok)
			assert.Equal(t, tt.wantUID, u.Name)
		})
	}
}

func TestStatusDualWriter_Update(t *testing.T) {
	const uid = "user-abc"

	tests := []struct {
		name string

		// inputs
		ctx               context.Context
		storeUsers        map[string]*common.UserWithRole
		updateLastSeenErr error
		unified           *fakeUnifiedStatus

		// expectations
		wantErr            bool
		wantErrContains    string
		wantUpdatedUID     string
		wantLegacyReturned bool
	}{
		{
			name:           "missing namespace returns error",
			ctx:            context.Background(),
			storeUsers:     map[string]*common.UserWithRole{},
			unified:        &fakeUnifiedStatus{},
			wantErr:        true,
			wantUpdatedUID: "",
		},
		{
			name:              "UpdateUserLastSeenAt error is returned",
			ctx:               namespaceContext(),
			storeUsers:        map[string]*common.UserWithRole{uid: makeTestUser(uid)},
			updateLastSeenErr: errors.New("db error"),
			unified:           &fakeUnifiedStatus{},
			wantErr:           true,
			wantErrContains:   "db error",
			wantUpdatedUID:    uid,
		},
		{
			name:           "legacy Get error after successful UpdateUserLastSeenAt",
			ctx:            namespaceContext(),
			storeUsers:     map[string]*common.UserWithRole{}, // user not found on Get
			unified:        &fakeUnifiedStatus{},
			wantErr:        true,
			wantUpdatedUID: uid,
		},
		{
			name:               "success writes to legacy and unified",
			ctx:                namespaceContext(),
			storeUsers:         map[string]*common.UserWithRole{uid: makeTestUser(uid)},
			unified:            &fakeUnifiedStatus{getObj: makeTestUserItem(uid)},
			wantErr:            false,
			wantUpdatedUID:     uid,
			wantLegacyReturned: true,
		},
		{
			name:               "unified Get error is best-effort: returns legacy, no error",
			ctx:                namespaceContext(),
			storeUsers:         map[string]*common.UserWithRole{uid: makeTestUser(uid)},
			unified:            &fakeUnifiedStatus{getErr: errors.New("unified unavailable")},
			wantErr:            false,
			wantUpdatedUID:     uid,
			wantLegacyReturned: true,
		},
		{
			name:               "unified Update error is best-effort: returns legacy, no error",
			ctx:                namespaceContext(),
			storeUsers:         map[string]*common.UserWithRole{uid: makeTestUser(uid)},
			unified:            &fakeUnifiedStatus{getObj: makeTestUserItem(uid), updateErr: errors.New("unified write failed")},
			wantErr:            false,
			wantUpdatedUID:     uid,
			wantLegacyReturned: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := &fakeStatusLegacyStore{
				users:             tt.storeUsers,
				updateLastSeenErr: tt.updateLastSeenErr,
			}
			w := newTestStatusWriter(store, tt.unified)

			before := time.Now()
			result, created, err := w.Update(tt.ctx, uid, nil, nil, nil, false, &v1.UpdateOptions{})
			after := time.Now()

			if tt.wantErr {
				require.Error(t, err)
				if tt.wantErrContains != "" {
					assert.Contains(t, err.Error(), tt.wantErrContains)
				}
				return
			}

			require.NoError(t, err)
			assert.False(t, created)

			if tt.wantUpdatedUID != "" {
				assert.Equal(t, tt.wantUpdatedUID, store.updatedUID)
				assert.False(t, store.updatedLastSeenAt.Before(before))
				assert.False(t, store.updatedLastSeenAt.After(after))
			}

			if tt.wantLegacyReturned {
				u, ok := result.(*iamv0alpha1.User)
				require.True(t, ok)
				assert.Equal(t, uid, u.Name)
			}
		})
	}
}

// fakeUnifiedStatus is a controllable implementation of unifiedStatusStorage.
type fakeUnifiedStatus struct {
	getObj    runtime.Object
	getErr    error
	updateErr error

	updatedLastSeenAt int64
}

func (f *fakeUnifiedStatus) New() runtime.Object {
	return iamv0alpha1.UserResourceInfo.NewFunc()
}

func (f *fakeUnifiedStatus) Destroy() {}

func (f *fakeUnifiedStatus) Get(_ context.Context, _ string, _ *v1.GetOptions) (runtime.Object, error) {
	return f.getObj, f.getErr
}

func (f *fakeUnifiedStatus) Update(_ context.Context, _ string, objInfo rest.UpdatedObjectInfo, _ rest.ValidateObjectFunc, _ rest.ValidateObjectUpdateFunc, _ bool, _ *v1.UpdateOptions) (runtime.Object, bool, error) {
	if f.updateErr != nil {
		return nil, false, f.updateErr
	}
	obj, err := objInfo.UpdatedObject(context.Background(), f.getObj)
	if err != nil {
		return nil, false, err
	}
	if u, ok := obj.(*iamv0alpha1.User); ok {
		f.updatedLastSeenAt = u.Status.LastSeenAt
	}
	return obj, false, nil
}

// fakeStatusLegacyStore is a minimal LegacyIdentityStore for status tests.
// It embeds the interface with nil value (panics if unexpected methods are called).
type fakeStatusLegacyStore struct {
	legacy.LegacyIdentityStore

	users             map[string]*common.UserWithRole
	updateLastSeenErr error
	updatedUID        string
	updatedLastSeenAt time.Time
}

func (f *fakeStatusLegacyStore) ListUsers(_ context.Context, _ claims.NamespaceInfo, q legacy.ListUserQuery) (*legacy.ListUserResult, error) {
	u, ok := f.users[q.UID]
	if !ok {
		return &legacy.ListUserResult{}, nil
	}
	return &legacy.ListUserResult{Items: []common.UserWithRole{*u}}, nil
}

func (f *fakeStatusLegacyStore) UpdateUserLastSeenAt(_ context.Context, _ claims.NamespaceInfo, uid string, lastSeenAt time.Time) error {
	f.updatedUID = uid
	f.updatedLastSeenAt = lastSeenAt
	return f.updateLastSeenErr
}

func makeTestUser(uid string) *common.UserWithRole {
	u := &common.UserWithRole{}
	u.UID = uid
	u.ID = 42
	u.Login = "testuser"
	u.Email = "test@example.com"
	u.OrgID = 1
	u.Updated = time.Now()
	return u
}

func makeTestUserItem(uid string) *iamv0alpha1.User {
	u := makeTestUser(uid)
	item := toUserItem(u, "default")
	obj, _ := utils.MetaAccessor(&item)
	obj.SetDeprecatedInternalID(u.ID) //nolint:staticcheck
	return &item
}

func newTestStatusWriter(store *fakeStatusLegacyStore, unified unifiedStatusStorage) *statusDualWriter {
	legacyStore := NewLegacyStore(store, claims.FixedAccessClient(true), tracing.NewNoopTracerService())
	gvr := iamv0alpha1.UserResourceInfo.GroupVersionResource()
	return &statusDualWriter{
		gv:     gvr.GroupVersion(),
		status: unified,
		legacy: legacyStore,
		store:  store,
	}
}

func namespaceContext() context.Context {
	return request.WithNamespace(context.Background(), "default")
}
