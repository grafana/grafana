package rest

import (
	"context"
	"errors"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func TestMode3_Create(t *testing.T) {
	type testCase struct {
		input          runtime.Object
		setupStorageFn func(m *mock.Mock, input runtime.Object)
		name           string
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name:  "creating an object only in the unified store",
				input: exampleObj,
				setupStorageFn: func(m *mock.Mock, input runtime.Object) {
					m.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObj, nil)
				},
			},
			{
				name:  "error when creating object in the unified store fails",
				input: failingObj,
				setupStorageFn: func(m *mock.Mock, input runtime.Object) {
					m.On("Create", mock.Anything, failingObj, mock.Anything, mock.Anything).Return(nil, errors.New("error"))
				},
				wantErr: true,
			},
		}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l := (LegacyStorage)(nil)
			s := (Storage)(nil)
			m := &mock.Mock{}

			ls := legacyStoreMock{m, l}
			us := storageMock{m, s}

			if tt.setupStorageFn != nil {
				tt.setupStorageFn(m, tt.input)
			}

			dw := NewDualWriter(Mode3, ls, us, p, kind)

			obj, err := dw.Create(context.Background(), tt.input, func(context.Context, runtime.Object) error { return nil }, &metav1.CreateOptions{})

			if tt.wantErr {
				assert.Error(t, err)
				return
			}

			assert.NoError(t, err)
			assert.NotEqual(t, obj, anotherObj)
		})
	}
}

func TestMode1_CreateOnLegacyStorage(t *testing.T) {
	ctxCanceled, cancel := context.WithCancel(context.TODO())
	cancel()

	type testCase struct {
		name          string
		input         runtime.Object
		ctx           *context.Context
		setupLegacyFn func(m *mock.Mock)
	}
	tests :=
		[]testCase{
			{
				name:  "Create on legacy storage",
				input: exampleObj,
				setupLegacyFn: func(m *mock.Mock) {
					m.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObjNoRV, nil)
				},
			},
			{
				name:  "Create on legacy storage works even if parent context is canceled",
				input: exampleObj,
				ctx:   &ctxCanceled,
				setupLegacyFn: func(m *mock.Mock) {
					m.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObjNoRV, nil)
				},
			},
		}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l := (LegacyStorage)(nil)
			s := (Storage)(nil)
			m := &mock.Mock{}

			ls := legacyStoreMock{m, l}
			us := storageMock{m, s}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(m)
			}

			ctx := context.TODO()
			if tt.ctx != nil {
				ctx = *tt.ctx
			}

			dw := NewDualWriter(Mode3, ls, us, p, kind)
			err := dw.(*DualWriterMode3).createOnLegacyStorage(ctx, tt.input, exampleObj, func(context.Context, runtime.Object) error { return nil }, &metav1.CreateOptions{})
			assert.NoError(t, err)
		})
	}
}

func TestMode3_Get(t *testing.T) {
	type testCase struct {
		setupStorageFn func(m *mock.Mock, name string)
		name           string
		input          string
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name:  "get an object only in unified store",
				input: "foo",
				setupStorageFn: func(m *mock.Mock, name string) {
					m.On("Get", mock.Anything, name, mock.Anything).Return(exampleObj, nil)
				},
			},
			{
				name:  "error when getting an object in the unified store fails",
				input: "object-fail",
				setupStorageFn: func(m *mock.Mock, name string) {
					m.On("Get", mock.Anything, name, mock.Anything).Return(nil, errors.New("error"))
				},
				wantErr: true,
			},
		}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l := (LegacyStorage)(nil)
			s := (Storage)(nil)
			m := &mock.Mock{}

			ls := legacyStoreMock{m, l}
			us := storageMock{m, s}

			if tt.setupStorageFn != nil {
				tt.setupStorageFn(m, tt.input)
			}

			p := prometheus.NewRegistry()
			dw := NewDualWriter(Mode3, ls, us, p, kind)

			obj, err := dw.Get(context.Background(), tt.input, &metav1.GetOptions{})

			if tt.wantErr {
				assert.Error(t, err)
				return
			}

			assert.Equal(t, obj, exampleObj)
			assert.NotEqual(t, obj, anotherObj)
		})
	}
}

func TestMode1_GetFromLegacyStorage(t *testing.T) {
	ctxCanceled, cancel := context.WithCancel(context.TODO())
	cancel()

	type testCase struct {
		setupLegacyFn func(m *mock.Mock, name string)
		ctx           *context.Context
		name          string
		input         string
	}
	tests :=
		[]testCase{
			{
				name:  "Get from legacy storage",
				input: "foo",
				setupLegacyFn: func(m *mock.Mock, name string) {
					m.On("Get", mock.Anything, name, mock.Anything).Return(exampleObj, nil)
				},
			},
			{
				name:  "Get from legacy storage works even if parent context is canceled",
				input: "foo",
				ctx:   &ctxCanceled,
				setupLegacyFn: func(m *mock.Mock, name string) {
					m.On("Get", mock.Anything, name, mock.Anything).Return(exampleObj, nil)
				},
			},
		}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l := (LegacyStorage)(nil)
			s := (Storage)(nil)
			m := &mock.Mock{}

			ls := legacyStoreMock{m, l}
			us := storageMock{m, s}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(m, tt.input)
			}

			ctx := context.TODO()
			if tt.ctx != nil {
				ctx = *tt.ctx
			}

			dw := NewDualWriter(Mode3, ls, us, p, kind)
			err := dw.(*DualWriterMode3).getFromLegacyStorage(ctx, exampleObj, tt.input, &metav1.GetOptions{})
			assert.NoError(t, err)
		})
	}
}

func TestMode3_List(t *testing.T) {
	type testCase struct {
		setupStorageFn func(m *mock.Mock, options *metainternalversion.ListOptions)
		name           string
		options        *metainternalversion.ListOptions
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name:    "error when listing an object in the unified store is not implemented",
				options: &metainternalversion.ListOptions{TypeMeta: metav1.TypeMeta{Kind: "fail"}},
				setupStorageFn: func(m *mock.Mock, options *metainternalversion.ListOptions) {
					m.On("List", mock.Anything, options).Return(nil, errors.New("error"))
				},
				wantErr: true,
			},
			{
				name:    "list objects in the unified store",
				options: &metainternalversion.ListOptions{TypeMeta: metav1.TypeMeta{Kind: "foo"}},
				setupStorageFn: func(m *mock.Mock, options *metainternalversion.ListOptions) {
					m.On("List", mock.Anything, options).Return(exampleList, nil)
				},
			},
		}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l := (LegacyStorage)(nil)
			s := (Storage)(nil)
			m := &mock.Mock{}

			ls := legacyStoreMock{m, l}
			us := storageMock{m, s}

			if tt.setupStorageFn != nil {
				tt.setupStorageFn(m, tt.options)
			}

			dw := NewDualWriter(Mode3, ls, us, p, kind)

			res, err := dw.List(context.Background(), tt.options)

			if tt.wantErr {
				assert.Error(t, err)
				return
			}

			assert.Equal(t, exampleList, res)
			assert.NotEqual(t, anotherList, res)
		})
	}
}

func TestMode1_ListFromLegacyStorage(t *testing.T) {
	ctxCanceled, cancel := context.WithCancel(context.TODO())
	cancel()

	type testCase struct {
		ctx           *context.Context
		name          string
		setupLegacyFn func(m *mock.Mock)
	}
	tests :=
		[]testCase{
			{
				name: "list from legacy storage",
				setupLegacyFn: func(m *mock.Mock) {
					m.On("List", mock.Anything, mock.Anything).Return(anotherList, nil)
				},
			},
			{
				name: "list from legacy storage works even if parent context is canceled",
				ctx:  &ctxCanceled,
				setupLegacyFn: func(m *mock.Mock) {
					m.On("List", mock.Anything, mock.Anything).Return(anotherList, nil)
				},
			},
		}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l := (LegacyStorage)(nil)
			s := (Storage)(nil)
			m := &mock.Mock{}

			ls := legacyStoreMock{m, l}
			us := storageMock{m, s}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(m)
			}

			ctx := context.TODO()
			if tt.ctx != nil {
				ctx = *tt.ctx
			}

			dw := NewDualWriter(Mode3, ls, us, p, kind)

			err := dw.(*DualWriterMode3).listFromLegacyStorage(ctx, &metainternalversion.ListOptions{}, anotherList)
			assert.NoError(t, err)
		})
	}
}

func TestMode3_Delete(t *testing.T) {
	type testCase struct {
		setupStorageFn func(m *mock.Mock, name string)
		name           string
		input          string
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name:  "deleting an object in the unified store",
				input: "foo",
				setupStorageFn: func(m *mock.Mock, name string) {
					m.On("Delete", mock.Anything, name, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
			},
			{
				name:  "error when deleting an object in the unified store",
				input: "object-fail",
				setupStorageFn: func(m *mock.Mock, name string) {
					m.On("Delete", mock.Anything, name, mock.Anything, mock.Anything).Return(nil, false, errors.New("error"))
				},
				wantErr: true,
			},
		}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l := (LegacyStorage)(nil)
			s := (Storage)(nil)
			m := &mock.Mock{}

			ls := legacyStoreMock{m, l}
			us := storageMock{m, s}

			if tt.setupStorageFn != nil {
				tt.setupStorageFn(m, tt.input)
			}

			dw := NewDualWriter(Mode3, ls, us, p, kind)

			obj, _, err := dw.Delete(context.Background(), tt.input, func(ctx context.Context, obj runtime.Object) error { return nil }, &metav1.DeleteOptions{})

			if tt.wantErr {
				assert.Error(t, err)
				return
			}

			assert.Equal(t, obj, exampleObj)
			assert.NotEqual(t, obj, anotherObj)
		})
	}
}

func TestMode1_DeleteFromLegacyStorage(t *testing.T) {
	ctxCanceled, cancel := context.WithCancel(context.TODO())
	cancel()

	type testCase struct {
		ctx           *context.Context
		setupLegacyFn func(m *mock.Mock, name string)
		name          string
		input         string
	}
	tests :=
		[]testCase{
			{
				name: "Delete from legacy storage",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Delete", mock.Anything, input, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
			},
			{
				name: "Delete from unified legacy works even if parent context is canceled",
				ctx:  &ctxCanceled,
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Delete", mock.Anything, input, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
			},
		}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l := (LegacyStorage)(nil)
			s := (Storage)(nil)
			m := &mock.Mock{}

			ls := legacyStoreMock{m, l}
			us := storageMock{m, s}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(m, tt.input)
			}

			ctx := context.TODO()
			if tt.ctx != nil {
				ctx = *tt.ctx
			}

			dw := NewDualWriter(Mode3, ls, us, p, kind)

			err := dw.(*DualWriterMode3).deleteFromLegacyStorage(ctx, exampleObj, tt.input, func(ctx context.Context, obj runtime.Object) error { return nil }, &metav1.DeleteOptions{})
			assert.NoError(t, err)
		})
	}
}

func TestMode3_DeleteCollection(t *testing.T) {
	type testCase struct {
		input          *metav1.DeleteOptions
		setupStorageFn func(m *mock.Mock, input *metav1.DeleteOptions)
		name           string
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name:  "deleting a collection in the unified store",
				input: &metav1.DeleteOptions{TypeMeta: metav1.TypeMeta{Kind: "foo"}},
				setupStorageFn: func(m *mock.Mock, input *metav1.DeleteOptions) {
					m.On("DeleteCollection", mock.Anything, mock.Anything, input, mock.Anything).Return(exampleObj, nil)
				},
			},
			{
				name:  "error deleting a collection in the unified store",
				input: &metav1.DeleteOptions{TypeMeta: metav1.TypeMeta{Kind: "fail"}},
				setupStorageFn: func(m *mock.Mock, input *metav1.DeleteOptions) {
					m.On("DeleteCollection", mock.Anything, mock.Anything, input, mock.Anything).Return(nil, errors.New("error"))
				},
				wantErr: true,
			},
		}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l := (LegacyStorage)(nil)
			s := (Storage)(nil)
			m := &mock.Mock{}

			ls := legacyStoreMock{m, l}
			us := storageMock{m, s}

			if tt.setupStorageFn != nil {
				tt.setupStorageFn(m, tt.input)
			}

			dw := NewDualWriter(Mode3, ls, us, p, kind)

			obj, err := dw.DeleteCollection(context.Background(), func(ctx context.Context, obj runtime.Object) error { return nil }, tt.input, &metainternalversion.ListOptions{})

			if tt.wantErr {
				assert.Error(t, err)
				return
			}

			assert.Equal(t, obj, exampleObj)
			assert.NotEqual(t, obj, anotherObj)
		})
	}
}

func TestMode1_DeleteCollectionFromLegacyStorage(t *testing.T) {
	ctxCanceled, cancel := context.WithCancel(context.TODO())
	cancel()

	type testCase struct {
		ctx           *context.Context
		setupLegacyFn func(m *mock.Mock)
		name          string
		input         *metav1.DeleteOptions
	}
	tests :=
		[]testCase{
			{
				name:  "Delete Collection from legacy storage",
				input: &metav1.DeleteOptions{TypeMeta: metav1.TypeMeta{Kind: "foo"}},
				setupLegacyFn: func(m *mock.Mock) {
					m.On("DeleteCollection", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObj, nil)
				},
			},
			{
				name:  "Delete Collection from legacy storage works even if parent context is canceled",
				input: &metav1.DeleteOptions{TypeMeta: metav1.TypeMeta{Kind: "foo"}},
				ctx:   &ctxCanceled,
				setupLegacyFn: func(m *mock.Mock) {
					m.On("DeleteCollection", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObj, nil)
				},
			},
		}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l := (LegacyStorage)(nil)
			s := (Storage)(nil)
			m := &mock.Mock{}

			ls := legacyStoreMock{m, l}
			us := storageMock{m, s}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(m)
			}

			ctx := context.TODO()
			if tt.ctx != nil {
				ctx = *tt.ctx
			}

			dw := NewDualWriter(Mode3, ls, us, p, kind)

			err := dw.(*DualWriterMode3).deleteCollectionFromLegacyStorage(ctx, exampleObj, func(ctx context.Context, obj runtime.Object) error { return nil }, tt.input, &metainternalversion.ListOptions{})
			assert.NoError(t, err)
		})
	}
}

func TestMode3_Update(t *testing.T) {
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
				name:  "update an object in unified store",
				input: "foo",
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Update", mock.Anything, input, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Update", mock.Anything, input, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
			},
			{
				name:  "error updating an object in unified store",
				input: "object-fail",
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Update", mock.Anything, input, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, false, errors.New("error"))
				},
				wantErr: true,
			},
		}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l := (LegacyStorage)(nil)
			s := (Storage)(nil)
			m := &mock.Mock{}

			ls := legacyStoreMock{m, l}
			us := storageMock{m, s}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(m, tt.input)
			}
			if tt.setupStorageFn != nil {
				tt.setupStorageFn(m, tt.input)
			}

			dw := NewDualWriter(Mode3, ls, us, p, kind)

			obj, _, err := dw.Update(context.Background(), tt.input, updatedObjInfoObj{}, func(ctx context.Context, obj runtime.Object) error { return nil }, func(ctx context.Context, obj, old runtime.Object) error { return nil }, false, &metav1.UpdateOptions{})

			if tt.wantErr {
				assert.Error(t, err)
				return
			}

			assert.NoError(t, err)

			assert.Equal(t, obj, exampleObj)
			assert.NotEqual(t, obj, anotherObj)
		})
	}
}

func TestMode1_UpdateOnLegacyStorage(t *testing.T) {
	ctxCanceled, cancel := context.WithCancel(context.TODO())
	cancel()

	type testCase struct {
		ctx           *context.Context
		setupLegacyFn func(m *mock.Mock, input string)
		setupGetFn    func(m *mock.Mock, input string)
		name          string
		input         string
	}
	tests :=
		[]testCase{
			{
				name:  "Update on legacy storage",
				input: "foo",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Update", mock.Anything, input, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(anotherObj, false, nil)
				},
				setupGetFn: func(m *mock.Mock, input string) {
					m.On("Get", mock.Anything, input, mock.Anything).Return(exampleObj, nil)
				},
			},
			{
				name:  "Update on legacy storage works even if parent context is canceled",
				ctx:   &ctxCanceled,
				input: "foo",
				setupLegacyFn: func(m *mock.Mock, input string) {
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
			m := &mock.Mock{}

			ls := legacyStoreMock{m, l}
			us := storageMock{m, s}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(m, tt.input)
			}

			if tt.setupGetFn != nil {
				tt.setupGetFn(m, tt.input)
			}

			ctx := context.TODO()
			if tt.ctx != nil {
				ctx = *tt.ctx
			}

			dw := NewDualWriter(Mode3, ls, us, p, kind)

			err := dw.(*DualWriterMode3).updateOnLegacyStorage(ctx, exampleObj, tt.input, updatedObjInfoObj{}, func(ctx context.Context, obj runtime.Object) error { return nil }, func(ctx context.Context, obj, old runtime.Object) error { return nil }, false, &metav1.UpdateOptions{})
			assert.NoError(t, err)
		})
	}
}
