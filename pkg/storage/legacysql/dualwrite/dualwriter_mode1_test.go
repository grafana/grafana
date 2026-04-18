package dualwrite

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/meta"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/apis/example"

	"github.com/grafana/grafana/pkg/apiserver/rest"
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

func TestMode1_DeleteCollection(t *testing.T) {
	type testCase struct {
		input          *metav1.DeleteOptions
		setupLegacyFn  func(s *fakeStorage)
		setupStorageFn func(s *fakeStorage)
		name           string
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name:  "should succeed when deleting a collection from LegacyStorage",
				input: &metav1.DeleteOptions{TypeMeta: metav1.TypeMeta{Kind: "foo"}},
				setupLegacyFn: func(s *fakeStorage) {
					s.onDeleteCollection(exampleObj, nil)
				},
				setupStorageFn: func(s *fakeStorage) {
					s.onDeleteCollection(exampleObj, nil)
				},
			},
			{
				name:  "should error when deleting a collection from LegacyStorage fails",
				input: &metav1.DeleteOptions{TypeMeta: metav1.TypeMeta{Kind: "fail"}},
				setupLegacyFn: func(s *fakeStorage) {
					s.onDeleteCollection(nil, errors.New("error"))
				},
				setupStorageFn: func(s *fakeStorage) {
					s.onDeleteCollection(exampleObj, nil)
				},
				wantErr: true,
			},
			{
				name:  "should not error when deleting a collection from UnifiedStorage fails",
				input: &metav1.DeleteOptions{TypeMeta: metav1.TypeMeta{Kind: "foo"}},
				setupLegacyFn: func(s *fakeStorage) {
					s.onDeleteCollection(exampleObj, nil)
				},
				setupStorageFn: func(s *fakeStorage) {
					s.onDeleteCollection(nil, errors.New("error"))
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

			obj, err := dw.DeleteCollection(context.Background(), func(ctx context.Context, obj runtime.Object) error { return nil }, tt.input, &metainternalversion.ListOptions{})

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
