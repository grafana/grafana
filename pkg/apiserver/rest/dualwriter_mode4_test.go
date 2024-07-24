package rest

import (
	"context"
	"errors"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"k8s.io/apimachinery/pkg/api/meta"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func TestMode4_Create(t *testing.T) {
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
					m.On("Create", mock.Anything, input, mock.Anything, mock.Anything).Return(nil, errors.New("error"))
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

			dw := NewDualWriter(Mode4, ls, us, p)

			obj, err := dw.Create(context.Background(), tt.input, func(context.Context, runtime.Object) error { return nil }, &metav1.CreateOptions{})

			if tt.wantErr {
				assert.Error(t, err)
				return
			}

			acc, err := meta.Accessor(obj)
			assert.NoError(t, err)
			assert.Equal(t, acc.GetResourceVersion(), "1")
			assert.NotEqual(t, obj, anotherObj)
		})
	}
}

func TestMode4_Get(t *testing.T) {
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
				name:  "error when getting an object in the inified store fails",
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
			dw := NewDualWriter(Mode4, ls, us, p)

			obj, err := dw.Get(context.Background(), tt.input, &metav1.GetOptions{})

			if tt.wantErr {
				assert.Error(t, err)
				return
			}

			us.AssertNotCalled(t, "Get", context.Background(), tt.name, &metav1.GetOptions{})

			assert.Equal(t, obj, exampleObj)
			assert.NotEqual(t, obj, anotherObj)
		})
	}
}

func TestMode4_List(t *testing.T) {
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

			dw := NewDualWriter(Mode4, ls, us, p)

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

func TestMode4_Delete(t *testing.T) {
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

			dw := NewDualWriter(Mode4, ls, us, p)

			obj, _, err := dw.Delete(context.Background(), tt.input, func(ctx context.Context, obj runtime.Object) error { return nil }, &metav1.DeleteOptions{})

			if tt.wantErr {
				assert.Error(t, err)
				return
			}

			us.AssertNotCalled(t, "Delete", context.Background(), tt.input, func(ctx context.Context, obj runtime.Object) error { return nil }, &metav1.DeleteOptions{})
			assert.Equal(t, obj, exampleObj)
			assert.NotEqual(t, obj, anotherObj)
		})
	}
}

func TestMode4_DeleteCollection(t *testing.T) {
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

			dw := NewDualWriter(Mode4, ls, us, p)

			obj, err := dw.DeleteCollection(context.Background(), func(ctx context.Context, obj runtime.Object) error { return nil }, tt.input, &metainternalversion.ListOptions{})

			if tt.wantErr {
				assert.Error(t, err)
				return
			}

			us.AssertNotCalled(t, "DeleteCollection", context.Background(), tt.input, func(ctx context.Context, obj runtime.Object) error { return nil }, &metav1.DeleteOptions{})
			assert.Equal(t, obj, exampleObj)
			assert.NotEqual(t, obj, anotherObj)
		})
	}
}

func TestMode4_Update(t *testing.T) {
	type testCase struct {
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

			if tt.setupStorageFn != nil {
				tt.setupStorageFn(m, tt.input)
			}

			dw := NewDualWriter(Mode4, ls, us, p)

			obj, _, err := dw.Update(context.Background(), tt.input, updatedObjInfoObj{}, func(ctx context.Context, obj runtime.Object) error { return nil }, func(ctx context.Context, obj, old runtime.Object) error { return nil }, false, &metav1.UpdateOptions{})

			if tt.wantErr {
				assert.Error(t, err)
				return
			}

			assert.Equal(t, obj, exampleObj)
			assert.NotEqual(t, obj, anotherObj)
		})
	}
}
