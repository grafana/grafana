package rest

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/meta"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/apis/example"
)

var now = time.Now()

var exampleObj = &example.Pod{TypeMeta: metav1.TypeMeta{Kind: "foo"}, ObjectMeta: metav1.ObjectMeta{Name: "foo", ResourceVersion: "1", CreationTimestamp: metav1.Time{}, GenerateName: "foo"}, Spec: example.PodSpec{}, Status: example.PodStatus{StartTime: &metav1.Time{Time: now}}}
var exampleObjNoRV = &example.Pod{TypeMeta: metav1.TypeMeta{Kind: "foo"}, ObjectMeta: metav1.ObjectMeta{Name: "foo", ResourceVersion: "", CreationTimestamp: metav1.Time{}, GenerateName: "foo"}, Spec: example.PodSpec{}, Status: example.PodStatus{StartTime: &metav1.Time{Time: now}}}
var anotherObj = &example.Pod{TypeMeta: metav1.TypeMeta{Kind: "foo"}, ObjectMeta: metav1.ObjectMeta{Name: "bar", ResourceVersion: "2", GenerateName: "foo"}, Spec: example.PodSpec{}, Status: example.PodStatus{StartTime: &metav1.Time{Time: now}}}
var failingObj = &example.Pod{TypeMeta: metav1.TypeMeta{Kind: "foo"}, ObjectMeta: metav1.ObjectMeta{Name: "object-fail", ResourceVersion: "2", GenerateName: "object-fail"}, Spec: example.PodSpec{}, Status: example.PodStatus{}}
var exampleList = &example.PodList{TypeMeta: metav1.TypeMeta{Kind: "foo"}, ListMeta: metav1.ListMeta{}, Items: []example.Pod{*exampleObj}}
var anotherList = &example.PodList{Items: []example.Pod{*anotherObj}}

var p = prometheus.NewRegistry()
var kind = "foo"

func TestMode1_Create(t *testing.T) {
	type testCase struct {
		input          runtime.Object
		setupLegacyFn  func(m *mock.Mock, input runtime.Object)
		setupStorageFn func(m *mock.Mock)
		name           string
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name:  "creating an object only in the legacy store",
				input: exampleObj,
				setupLegacyFn: func(m *mock.Mock, input runtime.Object) {
					m.On("Create", mock.Anything, input, mock.Anything, mock.Anything).Return(exampleObj, nil)
				},
				setupStorageFn: func(m *mock.Mock) {
					m.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObjNoRV, nil)
				},
			},
			{
				name:  "error when creating object in the legacy store fails",
				input: failingObj,
				setupLegacyFn: func(m *mock.Mock, input runtime.Object) {
					m.On("Create", mock.Anything, failingObj, mock.Anything, mock.Anything).Return(nil, errors.New("error"))
				},
				wantErr: true,
			},
		}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l := (LegacyStorage)(nil)
			s := (Storage)(nil)

			ls := legacyStoreMock{&mock.Mock{}, l}
			us := storageMock{&mock.Mock{}, s}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(ls.Mock, tt.input)
			}
			if tt.setupStorageFn != nil {
				tt.setupStorageFn(us.Mock)
			}

			dw := NewDualWriter(Mode1, ls, us, p, kind)

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

func TestMode1_CreateOnUnifiedStorage(t *testing.T) {
	ctxCanceled, cancel := context.WithCancel(context.TODO())
	cancel()

	type testCase struct {
		name           string
		input          runtime.Object
		ctx            *context.Context
		setupLegacyFn  func(m *mock.Mock)
		setupStorageFn func(m *mock.Mock)
	}
	tests :=
		[]testCase{
			{
				name:  "Create on unified storage",
				input: exampleObj,
				setupStorageFn: func(m *mock.Mock) {
					m.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObjNoRV, nil)
				},
			},
			{
				name:  "Create on unified storage works even if parent context is canceled",
				input: exampleObj,
				ctx:   &ctxCanceled,
				setupStorageFn: func(m *mock.Mock) {
					m.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObjNoRV, nil)
				},
			},
		}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l := (LegacyStorage)(nil)
			s := (Storage)(nil)

			ls := legacyStoreMock{&mock.Mock{}, l}
			us := storageMock{&mock.Mock{}, s}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(ls.Mock)
			}
			if tt.setupStorageFn != nil {
				tt.setupStorageFn(us.Mock)
			}

			ctx := context.TODO()
			if tt.ctx != nil {
				ctx = *tt.ctx
			}

			dw := NewDualWriter(Mode1, ls, us, p, kind)
			err := dw.(*DualWriterMode1).createOnUnifiedStorage(ctx, func(context.Context, runtime.Object) error { return nil }, tt.input, &metav1.CreateOptions{})
			require.NoError(t, err)
		})
	}
}

func TestMode1_Get(t *testing.T) {
	type testCase struct {
		setupLegacyFn  func(m *mock.Mock, name string)
		setupStorageFn func(m *mock.Mock, name string)
		name           string
		input          string
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name:  "get an object only in the legacy store",
				input: "foo",
				setupLegacyFn: func(m *mock.Mock, name string) {
					m.On("Get", mock.Anything, name, mock.Anything).Return(exampleObj, nil)
				},
				setupStorageFn: func(m *mock.Mock, name string) {
					m.On("Get", mock.Anything, name, mock.Anything).Return(anotherObj, nil)
				},
			},
			{
				name:  "error when getting an object in the legacy store fails",
				input: objectFailName("get"),
				setupLegacyFn: func(m *mock.Mock, name string) {
					m.On("Get", mock.Anything, name, mock.Anything).Return(nil, errors.New("error"))
				},
				setupStorageFn: func(m *mock.Mock, name string) {
					m.On("Get", mock.Anything, name, mock.Anything).Return(exampleObj, nil)
				},
				wantErr: true,
			},
		}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l := (LegacyStorage)(nil)
			s := (Storage)(nil)

			ls := legacyStoreMock{&mock.Mock{}, l}
			us := storageMock{&mock.Mock{}, s}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(ls.Mock, tt.input)
			}
			if tt.setupStorageFn != nil {
				tt.setupStorageFn(us.Mock, tt.input)
			}

			dw := NewDualWriter(Mode1, ls, us, p, kind)

			obj, err := dw.Get(context.Background(), tt.input, &metav1.GetOptions{})

			if tt.wantErr {
				require.Error(t, err)
				return
			}

			us.AssertNotCalled(t, "Get", context.Background(), tt.name, &metav1.GetOptions{})

			require.Equal(t, obj, exampleObj)
			require.NotEqual(t, obj, anotherObj)
		})
	}
}

func TestMode1_GetFromUnifiedStorage(t *testing.T) {
	ctxCanceled, cancel := context.WithCancel(context.TODO())
	cancel()

	type testCase struct {
		setupLegacyFn  func(m *mock.Mock, name string)
		setupStorageFn func(m *mock.Mock, name string)
		ctx            *context.Context
		name           string
		input          string
	}
	tests :=
		[]testCase{
			{
				name:  "Get from unified storage",
				input: "foo",
				setupStorageFn: func(m *mock.Mock, name string) {
					m.On("Get", mock.Anything, name, mock.Anything).Return(exampleObj, nil)
				},
			},
			{
				name:  "Get from unified storage works even if parent context is canceled",
				input: "foo",
				ctx:   &ctxCanceled,
				setupStorageFn: func(m *mock.Mock, name string) {
					m.On("Get", mock.Anything, name, mock.Anything).Return(exampleObj, nil)
				},
			},
		}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l := (LegacyStorage)(nil)
			s := (Storage)(nil)

			ls := legacyStoreMock{&mock.Mock{}, l}
			us := storageMock{&mock.Mock{}, s}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(ls.Mock, tt.input)
			}
			if tt.setupStorageFn != nil {
				tt.setupStorageFn(us.Mock, tt.input)
			}

			ctx := context.TODO()
			if tt.ctx != nil {
				ctx = *tt.ctx
			}

			dw := NewDualWriter(Mode1, ls, us, p, kind)
			err := dw.(*DualWriterMode1).getFromUnifiedStorage(ctx, exampleObj, tt.input, &metav1.GetOptions{})
			require.NoError(t, err)
		})
	}
}

func TestMode1_List(t *testing.T) {
	type testCase struct {
		setupLegacyFn  func(m *mock.Mock)
		setupStorageFn func(m *mock.Mock)
		name           string
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name: "error when listing an object in the legacy store is not implemented",
				setupLegacyFn: func(m *mock.Mock) {
					m.On("List", mock.Anything, mock.Anything).Return(nil, errors.New("error"))
				},
				setupStorageFn: func(m *mock.Mock) {
					m.On("List", mock.Anything, mock.Anything).Return(&example.PodList{}, nil)
				},
			},
			// TODO: legacy list is missing
		}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l := (LegacyStorage)(nil)
			s := (Storage)(nil)

			ls := legacyStoreMock{&mock.Mock{}, l}
			us := storageMock{&mock.Mock{}, s}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(ls.Mock)
			}
			if tt.setupStorageFn != nil {
				tt.setupStorageFn(us.Mock)
			}

			dw := NewDualWriter(Mode1, ls, us, p, kind)

			_, err := dw.List(context.Background(), &metainternalversion.ListOptions{
				TypeMeta: metav1.TypeMeta{
					Kind: "fail",
				},
			})

			if tt.wantErr {
				require.Error(t, err)
				return
			}
		})
	}
}

func TestMode1_ListFromUnifiedStorage(t *testing.T) {
	ctxCanceled, cancel := context.WithCancel(context.TODO())
	cancel()

	type testCase struct {
		ctx            *context.Context
		name           string
		setupLegacyFn  func(m *mock.Mock)
		setupStorageFn func(m *mock.Mock)
	}
	tests :=
		[]testCase{
			{
				name: "list from unified storage",
				setupStorageFn: func(m *mock.Mock) {
					m.On("List", mock.Anything, mock.Anything).Return(anotherList, nil)
				},
				setupLegacyFn: func(m *mock.Mock) {
					m.On("List", mock.Anything, mock.Anything).Return(anotherList, nil)
				},
			},
			{
				name: "list from unified storage works even if parent context is canceled",
				ctx:  &ctxCanceled,
				setupStorageFn: func(m *mock.Mock) {
					m.On("List", mock.Anything, mock.Anything).Return(anotherList, nil)
				},
			},
		}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l := (LegacyStorage)(nil)
			s := (Storage)(nil)

			ls := legacyStoreMock{&mock.Mock{}, l}
			us := storageMock{&mock.Mock{}, s}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(ls.Mock)
			}
			if tt.setupStorageFn != nil {
				tt.setupStorageFn(us.Mock)
			}

			ctx := context.TODO()
			if tt.ctx != nil {
				ctx = *tt.ctx
			}

			dw := NewDualWriter(Mode1, ls, us, p, kind)

			err := dw.(*DualWriterMode1).listFromUnifiedStorage(ctx, &metainternalversion.ListOptions{}, anotherList)
			require.NoError(t, err)
		})
	}
}

func TestMode1_Delete(t *testing.T) {
	type testCase struct {
		setupLegacyFn  func(m *mock.Mock, name string)
		setupStorageFn func(m *mock.Mock, name string)
		name           string
		input          string
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name:  "deleting an object in the legacy store",
				input: "foo",
				setupLegacyFn: func(m *mock.Mock, name string) {
					m.On("Delete", mock.Anything, name, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
				setupStorageFn: func(m *mock.Mock, name string) {
					m.On("Delete", mock.Anything, name, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
			},
			{
				name:  "error when deleting an object in the legacy store",
				input: objectFailName("delete"),
				setupLegacyFn: func(m *mock.Mock, name string) {
					m.On("Delete", mock.Anything, name, mock.Anything, mock.Anything).Return(nil, false, errors.New("error"))
				},
				setupStorageFn: func(m *mock.Mock, name string) {
					m.On("Delete", mock.Anything, name, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
				wantErr: true,
			},
		}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l := (LegacyStorage)(nil)
			s := (Storage)(nil)

			ls := legacyStoreMock{&mock.Mock{}, l}
			us := storageMock{&mock.Mock{}, s}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(ls.Mock, tt.input)
			}
			if tt.setupStorageFn != nil {
				tt.setupStorageFn(us.Mock, tt.input)
			}

			dw := NewDualWriter(Mode1, ls, us, p, kind)

			obj, _, err := dw.Delete(context.Background(), tt.input, func(ctx context.Context, obj runtime.Object) error { return nil }, &metav1.DeleteOptions{})

			if tt.wantErr {
				require.Error(t, err)
				return
			}

			us.AssertNotCalled(t, "Delete", context.Background(), tt.input, func(ctx context.Context, obj runtime.Object) error { return nil }, &metav1.DeleteOptions{})
			require.Equal(t, obj, exampleObj)
			require.NotEqual(t, obj, anotherObj)
		})
	}
}

func TestMode1_DeleteFromUnifiedStorage(t *testing.T) {
	ctxCanceled, cancel := context.WithCancel(context.TODO())
	cancel()

	type testCase struct {
		ctx            *context.Context
		setupLegacyFn  func(m *mock.Mock, name string)
		setupStorageFn func(m *mock.Mock, name string)
		name           string
		input          string
	}
	tests :=
		[]testCase{
			{
				name: "Delete from unified storage",
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Delete", mock.Anything, input, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
			},
			{
				name: "Delete from unified storage works even if parent context is canceled",
				ctx:  &ctxCanceled,
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Delete", mock.Anything, input, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
			},
		}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l := (LegacyStorage)(nil)
			s := (Storage)(nil)

			ls := legacyStoreMock{&mock.Mock{}, l}
			us := storageMock{&mock.Mock{}, s}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(ls.Mock, tt.input)
			}
			if tt.setupStorageFn != nil {
				tt.setupStorageFn(us.Mock, tt.input)
			}

			ctx := context.TODO()
			if tt.ctx != nil {
				ctx = *tt.ctx
			}

			dw := NewDualWriter(Mode1, ls, us, p, kind)

			err := dw.(*DualWriterMode1).deleteFromUnifiedStorage(ctx, exampleObj, tt.input, func(ctx context.Context, obj runtime.Object) error { return nil }, &metav1.DeleteOptions{})
			require.NoError(t, err)
		})
	}
}

func TestMode1_DeleteCollection(t *testing.T) {
	type testCase struct {
		input          *metav1.DeleteOptions
		setupLegacyFn  func(m *mock.Mock, input *metav1.DeleteOptions)
		setupStorageFn func(m *mock.Mock, input *metav1.DeleteOptions)
		name           string
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name:  "deleting a collection in the legacy store",
				input: &metav1.DeleteOptions{TypeMeta: metav1.TypeMeta{Kind: "foo"}},
				setupLegacyFn: func(m *mock.Mock, input *metav1.DeleteOptions) {
					m.On("DeleteCollection", mock.Anything, mock.Anything, input, mock.Anything).Return(exampleObj, nil)
				},
				setupStorageFn: func(m *mock.Mock, input *metav1.DeleteOptions) {
					m.On("DeleteCollection", mock.Anything, mock.Anything, input, mock.Anything).Return(exampleObj, nil)
				},
			},
			{
				name:  "error deleting a collection in the legacy store",
				input: &metav1.DeleteOptions{TypeMeta: metav1.TypeMeta{Kind: "fail"}},
				setupLegacyFn: func(m *mock.Mock, input *metav1.DeleteOptions) {
					m.On("DeleteCollection", mock.Anything, mock.Anything, input, mock.Anything).Return(nil, errors.New("error"))
				},
				setupStorageFn: func(m *mock.Mock, input *metav1.DeleteOptions) {
					m.On("DeleteCollection", mock.Anything, mock.Anything, input, mock.Anything).Return(exampleObj, nil)
				},
				wantErr: true,
			},
		}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l := (LegacyStorage)(nil)
			s := (Storage)(nil)

			ls := legacyStoreMock{&mock.Mock{}, l}
			us := storageMock{&mock.Mock{}, s}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(ls.Mock, tt.input)
			}
			if tt.setupStorageFn != nil {
				tt.setupStorageFn(us.Mock, tt.input)
			}

			dw := NewDualWriter(Mode1, ls, us, p, kind)

			obj, err := dw.DeleteCollection(context.Background(), func(ctx context.Context, obj runtime.Object) error { return nil }, tt.input, &metainternalversion.ListOptions{})

			if tt.wantErr {
				require.Error(t, err)
				return
			}

			us.AssertNotCalled(t, "DeleteCollection", context.Background(), tt.input, func(ctx context.Context, obj runtime.Object) error { return nil }, &metav1.DeleteOptions{})
			require.Equal(t, obj, exampleObj)
			require.NotEqual(t, obj, anotherObj)
		})
	}
}

func TestMode1_DeleteCollectionFromUnifiedStorage(t *testing.T) {
	ctxCanceled, cancel := context.WithCancel(context.TODO())
	cancel()

	type testCase struct {
		ctx            *context.Context
		setupLegacyFn  func(m *mock.Mock)
		setupStorageFn func(m *mock.Mock)
		name           string
		input          *metav1.DeleteOptions
	}
	tests :=
		[]testCase{
			{
				name:  "Delete Collection from unified storage",
				input: &metav1.DeleteOptions{TypeMeta: metav1.TypeMeta{Kind: "foo"}},
				setupStorageFn: func(m *mock.Mock) {
					m.On("DeleteCollection", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObj, nil)
				},
			},
			{
				name:  "Delete Collection from unified storage works even if parent context is canceled",
				input: &metav1.DeleteOptions{TypeMeta: metav1.TypeMeta{Kind: "foo"}},
				ctx:   &ctxCanceled,
				setupStorageFn: func(m *mock.Mock) {
					m.On("DeleteCollection", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObj, nil)
				},
			},
		}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l := (LegacyStorage)(nil)
			s := (Storage)(nil)

			ls := legacyStoreMock{&mock.Mock{}, l}
			us := storageMock{&mock.Mock{}, s}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(ls.Mock)
			}
			if tt.setupStorageFn != nil {
				tt.setupStorageFn(us.Mock)
			}

			ctx := context.TODO()
			if tt.ctx != nil {
				ctx = *tt.ctx
			}

			dw := NewDualWriter(Mode1, ls, us, p, kind)

			err := dw.(*DualWriterMode1).deleteCollectionFromUnifiedStorage(ctx, exampleObj, func(ctx context.Context, obj runtime.Object) error { return nil }, tt.input, &metainternalversion.ListOptions{})
			require.NoError(t, err)
		})
	}
}

func TestMode1_Update(t *testing.T) {
	type testCase struct {
		setupLegacyFn  func(m *mock.Mock, input string)
		setupStorageFn func(m *mock.Mock, input string)
		name           string
		input          string
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name:  "update an object in legacy",
				input: "foo",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Update", mock.Anything, input, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Update", mock.Anything, input, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(anotherObj, false, nil)
				},
			},
			{
				name:  "error updating an object in legacy",
				input: objectFailName("update"),
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Update", mock.Anything, input, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, false, errors.New("error"))
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Update", mock.Anything, input, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(anotherObj, false, nil)
				},
				wantErr: true,
			},
		}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l := (LegacyStorage)(nil)
			s := (Storage)(nil)

			ls := legacyStoreMock{&mock.Mock{}, l}
			us := storageMock{&mock.Mock{}, s}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(ls.Mock, tt.input)
			}
			if tt.setupStorageFn != nil {
				tt.setupStorageFn(us.Mock, tt.input)
			}

			dw := NewDualWriter(Mode1, ls, us, p, kind)

			obj, _, err := dw.Update(context.Background(), tt.input, updatedObjInfoObj{}, func(ctx context.Context, obj runtime.Object) error { return nil }, func(ctx context.Context, obj, old runtime.Object) error { return nil }, false, &metav1.UpdateOptions{})

			if tt.wantErr {
				require.Error(t, err)
				return
			}

			require.Equal(t, obj, exampleObj)
			require.NotEqual(t, obj, anotherObj)
		})
	}
}

func TestMode1_UpdateOnUnifiedStorage(t *testing.T) {
	ctxCanceled, cancel := context.WithCancel(context.TODO())
	cancel()

	type testCase struct {
		ctx            *context.Context
		setupLegacyFn  func(m *mock.Mock, input string)
		setupStorageFn func(m *mock.Mock, input string)
		setupGetFn     func(m *mock.Mock, input string)
		name           string
		input          string
	}
	tests :=
		[]testCase{
			{
				name:  "Update on unified storage",
				input: "foo",
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Update", mock.Anything, input, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(anotherObj, false, nil)
				},
				setupGetFn: func(m *mock.Mock, input string) {
					m.On("Get", mock.Anything, input, mock.Anything).Return(exampleObj, nil)
				},
			},
			{
				name:  "Update on unified storage works even if parent context is canceled",
				ctx:   &ctxCanceled,
				input: "foo",
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Update", mock.Anything, input, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(anotherObj, false, nil)
				},
				setupGetFn: func(m *mock.Mock, input string) {
					m.On("Get", mock.Anything, input, mock.Anything).Return(exampleObj, nil)
				},
			},
		}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l := (LegacyStorage)(nil)
			s := (Storage)(nil)

			ls := legacyStoreMock{&mock.Mock{}, l}
			us := storageMock{&mock.Mock{}, s}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(ls.Mock, tt.input)
			}
			if tt.setupStorageFn != nil {
				tt.setupStorageFn(us.Mock, tt.input)
			}

			if tt.setupGetFn != nil {
				tt.setupGetFn(ls.Mock, tt.input)
				tt.setupGetFn(us.Mock, tt.input)
			}

			ctx := context.TODO()
			if tt.ctx != nil {
				ctx = *tt.ctx
			}

			dw := NewDualWriter(Mode1, ls, us, p, kind)

			err := dw.(*DualWriterMode1).updateOnUnifiedStorageMode1(ctx, exampleObj, tt.input, updatedObjInfoObj{}, func(ctx context.Context, obj runtime.Object) error { return nil }, func(ctx context.Context, obj, old runtime.Object) error { return nil }, false, &metav1.UpdateOptions{})
			require.NoError(t, err)
		})
	}
}

func objectFailName(prefix string) string {
	return fmt.Sprintf("%s/%s", prefix, failingObject)
}
