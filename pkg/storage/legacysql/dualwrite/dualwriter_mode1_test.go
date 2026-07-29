package dualwrite

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/meta"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/apis/example"
	k8srest "k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer/storewrapper"
)

var now = time.Now()

var exampleObj = &example.Pod{TypeMeta: metav1.TypeMeta{Kind: "foo"}, ObjectMeta: metav1.ObjectMeta{Name: "foo", ResourceVersion: "1", CreationTimestamp: metav1.Time{}, GenerateName: "foo"}, Spec: example.PodSpec{}, Status: example.PodStatus{StartTime: &metav1.Time{Time: now}}}
var exampleObjNoRV = &example.Pod{TypeMeta: metav1.TypeMeta{Kind: "foo"}, ObjectMeta: metav1.ObjectMeta{Name: "foo", ResourceVersion: "", CreationTimestamp: metav1.Time{}, GenerateName: "foo"}, Spec: example.PodSpec{}, Status: example.PodStatus{StartTime: &metav1.Time{Time: now}}}
var anotherObj = &example.Pod{TypeMeta: metav1.TypeMeta{Kind: "foo"}, ObjectMeta: metav1.ObjectMeta{Name: "bar", ResourceVersion: "2", GenerateName: "foo"}, Spec: example.PodSpec{}, Status: example.PodStatus{StartTime: &metav1.Time{Time: now}}}
var failingObj = &example.Pod{TypeMeta: metav1.TypeMeta{Kind: "foo"}, ObjectMeta: metav1.ObjectMeta{Name: "object-fail", ResourceVersion: "2", GenerateName: "object-fail"}, Spec: example.PodSpec{}, Status: example.PodStatus{}}
var exampleList = &example.PodList{TypeMeta: metav1.TypeMeta{Kind: "foo"}, ListMeta: metav1.ListMeta{}, Items: []example.Pod{*exampleObj}}
var anotherList = &example.PodList{Items: []example.Pod{*anotherObj}}

func TestMode1_Create(t *testing.T) {
	type testCase struct {
		input          runtime.Object
		setupLegacyFn  func(s *fakeStorage, input runtime.Object)
		setupStorageFn func(s *fakeStorage)
		name           string
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name:  "creating an object only in the legacy store",
				input: exampleObj,
				setupLegacyFn: func(s *fakeStorage, input runtime.Object) {
					s.onCreate(exampleObj, nil)
				},
				setupStorageFn: func(s *fakeStorage) {
					s.onCreate(exampleObjNoRV, nil)
				},
			},
			{
				name:  "error when creating object in the legacy store fails",
				input: failingObj,
				setupLegacyFn: func(s *fakeStorage, input runtime.Object) {
					s.onCreate(nil, errors.New("error"))
				},
				wantErr: true,
			},
			{
				name:  "should not error when unified create fails in background",
				input: exampleObj,
				setupLegacyFn: func(s *fakeStorage, input runtime.Object) {
					s.onCreate(exampleObj, nil)
				},
				setupStorageFn: func(s *fakeStorage) {
					s.onCreate(nil, errors.New("unified error"))
				},
			},
		}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ls := &fakeStorage{}
			us := &fakeStorage{}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(ls, tt.input)
			}
			if tt.setupStorageFn != nil {
				tt.setupStorageFn(us)
			}

			dw, err := newStorage(kind, rest.Mode1, ls, us)
			require.NoError(t, err)

			obj, err := dw.Create(context.Background(), tt.input, func(context.Context, runtime.Object) error { return nil }, &metav1.CreateOptions{})

			if tt.wantErr {
				require.Error(t, err)
				return
			}

			acc, err := meta.Accessor(obj)
			require.NoError(t, err)
			require.Equal(t, acc.GetResourceVersion(), "1")
			require.NotEqual(t, obj, anotherObj)
		})
	}
}

func TestMode1_Get(t *testing.T) {
	type testCase struct {
		setupLegacyFn  func(s *fakeStorage)
		setupStorageFn func(s *fakeStorage)
		name           string
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name: "should succeed when getting an object from LegacyStorage",
				setupLegacyFn: func(s *fakeStorage) {
					s.onGet(exampleObj, nil)
				},
				setupStorageFn: func(s *fakeStorage) {
					s.onGet(anotherObj, nil)
				},
			},
			{
				name: "should error when getting an object from LegacyStorage fails",
				setupLegacyFn: func(s *fakeStorage) {
					s.onGet(nil, errors.New("error"))
				},
				setupStorageFn: func(s *fakeStorage) {
					s.onGet(exampleObj, nil)
				},
				wantErr: true,
			},
			{
				name: "should not error when getting an object from UnifiedStorage fails",
				setupLegacyFn: func(s *fakeStorage) {
					s.onGet(exampleObj, nil)
				},
				setupStorageFn: func(s *fakeStorage) {
					s.onGet(nil, errors.New("error"))
				},
			},
			{
				name: "should not block for unified storage",
				setupLegacyFn: func(s *fakeStorage) {
					s.onGet(exampleObj, nil)
				},
				setupStorageFn: func(s *fakeStorage) {
					s.blockGet = true
				},
			},
		}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ls := &fakeStorage{}
			us := &fakeStorage{}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(ls)
			}
			if tt.setupStorageFn != nil {
				tt.setupStorageFn(us)
			}

			dw, err := newStorage(kind, rest.Mode1, ls, us)
			require.NoError(t, err)

			obj, err := dw.Get(context.Background(), "foo", &metav1.GetOptions{})

			if tt.wantErr {
				require.Error(t, err)
				return
			}

			require.Equal(t, obj, exampleObj)
			require.NotEqual(t, obj, anotherObj)
		})
	}
}

func TestMode1_List(t *testing.T) {
	type testCase struct {
		setupLegacyFn  func(s *fakeStorage)
		setupStorageFn func(s *fakeStorage)
		name           string
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name: "should error when listing from LegacyStorage fails",
				setupLegacyFn: func(s *fakeStorage) {
					s.onList(nil, errors.New("error"))
				},
				setupStorageFn: func(s *fakeStorage) {
					s.onList(&example.PodList{}, nil)
				},
				wantErr: true,
			},
			{
				name: "should not error when listing from UnifiedStorage fails",
				setupLegacyFn: func(s *fakeStorage) {
					s.onList(&example.PodList{}, nil)
				},
				setupStorageFn: func(s *fakeStorage) {
					s.onList(nil, errors.New("error"))
				},
			},
		}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ls := &fakeStorage{}
			us := &fakeStorage{}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(ls)
			}
			if tt.setupStorageFn != nil {
				tt.setupStorageFn(us)
			}

			dw, err := newStorage(kind, rest.Mode1, ls, us)
			require.NoError(t, err)

			_, err = dw.List(context.Background(), &metainternalversion.ListOptions{})

			if tt.wantErr {
				require.Error(t, err)
				return
			}
		})
	}
}

func TestMode1_Delete(t *testing.T) {
	type testCase struct {
		setupLegacyFn  func(s *fakeStorage)
		setupStorageFn func(s *fakeStorage)
		name           string
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name: "should succeed when deleting an object from LegacyStorage",
				setupLegacyFn: func(s *fakeStorage) {
					s.onDelete(exampleObj, nil)
				},
				setupStorageFn: func(s *fakeStorage) {
					s.onDelete(exampleObj, nil)
				},
			},
			{
				name: "should error when deleting an object from LegacyStorage fails",
				setupLegacyFn: func(s *fakeStorage) {
					s.onDelete(nil, errors.New("error"))
				},
				setupStorageFn: func(s *fakeStorage) {
					s.onDelete(exampleObj, nil)
				},
				wantErr: true,
			},
			{
				name: "should not error when deleting an object from UnifiedStorage fails",
				setupLegacyFn: func(s *fakeStorage) {
					s.onDelete(exampleObj, nil)
				},
				setupStorageFn: func(s *fakeStorage) {
					s.onDelete(nil, errors.New("error"))
				},
			},
		}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ls := &fakeStorage{}
			us := &fakeStorage{}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(ls)
			}
			if tt.setupStorageFn != nil {
				tt.setupStorageFn(us)
			}

			dw, err := newStorage(kind, rest.Mode1, ls, us)
			require.NoError(t, err)

			obj, _, err := dw.Delete(context.Background(), "foo", func(ctx context.Context, obj runtime.Object) error { return nil }, &metav1.DeleteOptions{})

			if tt.wantErr {
				require.Error(t, err)
				return
			}

			require.Equal(t, obj, exampleObj)
			require.NotEqual(t, obj, anotherObj)
		})
	}
}

func TestMode1_Update(t *testing.T) {
	type testCase struct {
		setupLegacyFn  func(s *fakeStorage)
		setupStorageFn func(s *fakeStorage)
		name           string
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name: "should succeed when updating an object in LegacyStorage",
				setupLegacyFn: func(s *fakeStorage) {
					s.onUpdate(exampleObj, nil)
				},
				setupStorageFn: func(s *fakeStorage) {
					s.onUpdate(anotherObj, nil)
				},
			},
			{
				name: "should error when updating an object in LegacyStorage fails",
				setupLegacyFn: func(s *fakeStorage) {
					s.onUpdate(nil, errors.New("error"))
				},
				setupStorageFn: func(s *fakeStorage) {
					s.onUpdate(anotherObj, nil)
				},
				wantErr: true,
			},
			{
				name: "should not error when updating an object in UnifiedStorage fails",
				setupLegacyFn: func(s *fakeStorage) {
					s.onUpdate(exampleObj, nil)
				},
				setupStorageFn: func(s *fakeStorage) {
					s.onUpdate(nil, errors.New("error"))
				},
			},
		}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ls := &fakeStorage{}
			us := &fakeStorage{}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(ls)
			}
			if tt.setupStorageFn != nil {
				tt.setupStorageFn(us)
			}

			dw, err := newStorage(kind, rest.Mode1, ls, us)
			require.NoError(t, err)

			obj, _, err := dw.Update(context.Background(), "foo", updatedObjInfoObj{}, func(ctx context.Context, obj runtime.Object) error { return nil }, func(ctx context.Context, obj, old runtime.Object) error { return nil }, false, &metav1.UpdateOptions{})

			if tt.wantErr {
				require.Error(t, err)
				return
			}

			require.Equal(t, obj, exampleObj)
			require.NotEqual(t, obj, anotherObj)
		})
	}
}

func TestMode1_UpdateBackgroundAuthorizationOutlivesRequest(t *testing.T) {
	legacy := &fakeStorage{}
	legacy.onUpdate(exampleObj, nil)

	unified := &blockingUpdateStorage{
		fakeStorage: &fakeStorage{},
		started:     make(chan struct{}),
		release:     make(chan struct{}),
		result:      make(chan backgroundUpdateResult, 1),
	}

	dw, err := newStorage(kind, rest.Mode1, legacy, unified)
	require.NoError(t, err)
	inner, ok := dw.(storewrapper.K8sStorage)
	require.True(t, ok)

	authz := &requestLifecycleAuthorizer{result: make(chan authorizationResult, 1)}
	storage := storewrapper.New(inner, kind, authz)

	requestCtx, cancelRequest := context.WithCancel(identity.WithRequester(
		context.Background(),
		&identity.StaticRequester{UserUID: "fake-user-uid", Type: types.TypeUser, Namespace: "fake-namespace"},
	))

	obj, _, err := storage.Update(
		requestCtx,
		"foo",
		updatedObjInfoObj{},
		func(context.Context, runtime.Object) error { return nil },
		func(context.Context, runtime.Object, runtime.Object) error { return nil },
		false,
		&metav1.UpdateOptions{},
	)
	require.NoError(t, err)
	require.Equal(t, exampleObj, obj)

	select {
	case <-unified.started:
	case <-time.After(time.Second):
		t.Fatal("background unified update did not start")
	}

	cancelRequest()
	close(unified.release)

	select {
	case got := <-authz.result:
		require.NoError(t, got.contextErr)
		require.NoError(t, got.identityErr)
		require.Equal(t, "user:fake-user-uid", got.uid)
		require.True(t, got.authInfoOK)
		require.Equal(t, "fake-namespace", got.namespace)
	case <-time.After(time.Second):
		t.Fatal("background authorization did not complete")
	}

	select {
	case got := <-unified.result:
		require.NoError(t, got.contextErr)
		require.NoError(t, got.updateErr)
	case <-time.After(time.Second):
		t.Fatal("background unified update did not complete")
	}
}

type blockingUpdateStorage struct {
	*fakeStorage
	started chan struct{}
	release chan struct{}
	result  chan backgroundUpdateResult
}

type backgroundUpdateResult struct {
	contextErr error
	updateErr  error
}

func (s *blockingUpdateStorage) Update(
	ctx context.Context,
	_ string,
	objInfo k8srest.UpdatedObjectInfo,
	_ k8srest.ValidateObjectFunc,
	_ k8srest.ValidateObjectUpdateFunc,
	_ bool,
	_ *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	close(s.started)
	<-s.release

	_, err := objInfo.UpdatedObject(ctx, exampleObj)
	s.result <- backgroundUpdateResult{contextErr: ctx.Err(), updateErr: err}
	return anotherObj, false, err
}

type requestLifecycleAuthorizer struct {
	result chan authorizationResult
}

type authorizationResult struct {
	contextErr  error
	identityErr error
	uid         string
	authInfoOK  bool
	namespace   string
}

func (a *requestLifecycleAuthorizer) BeforeCreate(context.Context, runtime.Object) error {
	return nil
}

func (a *requestLifecycleAuthorizer) BeforeUpdate(ctx context.Context, _, _ runtime.Object) error {
	user, identityErr := identity.GetRequester(ctx)
	uid := ""
	if identityErr == nil {
		uid = user.GetUID()
	}
	authInfo, authInfoOK := types.AuthInfoFrom(ctx)
	namespace := ""
	if authInfoOK {
		namespace = authInfo.GetNamespace()
	}
	a.result <- authorizationResult{
		contextErr:  ctx.Err(),
		identityErr: identityErr,
		uid:         uid,
		authInfoOK:  authInfoOK,
		namespace:   namespace,
	}
	return ctx.Err()
}

func (a *requestLifecycleAuthorizer) BeforeDelete(context.Context, runtime.Object) error {
	return nil
}

func (a *requestLifecycleAuthorizer) AfterGet(context.Context, runtime.Object) error {
	return nil
}

func (a *requestLifecycleAuthorizer) FilterList(_ context.Context, list runtime.Object) (runtime.Object, error) {
	return list, nil
}

func (a *requestLifecycleAuthorizer) WatchFilter(context.Context) (storewrapper.WatchEventFilter, error) {
	return storewrapper.PassThroughWatchFilter, nil
}
