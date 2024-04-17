package rest

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func TestMode3_Create(t *testing.T) {
	type testCase struct {
		name           string
		input          runtime.Object
		setupLegacyFn  func(m *mock.Mock, input runtime.Object)
		setupStorageFn func(m *mock.Mock, input runtime.Object)
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name:  "creating an object in both the legacy and storage",
				input: exampleObj,
				setupLegacyFn: func(m *mock.Mock, input runtime.Object) {
					m.On("Create", context.Background(), input, mock.Anything, mock.Anything).Return(exampleObj, nil)
				},
				setupUSFn: func(m *mock.Mock, input runtime.Object) {
					m.On("Create", context.Background(), input, mock.Anything, mock.Anything).Return(exampleObj, nil)
				},
			},
			{
				name:  "error when creating object in storage fails",
				input: failingObj,
				setupStorageFn: func(m *mock.Mock, input runtime.Object) {
					m.On("Create", context.Background(), input, mock.Anything, mock.Anything).Return(nil, errors.New("error"))
				},
				wantErr: true,
			},
			{
				name:  "error when creating object in legacy storage fails",
				input: failingObj,
				setupStorageFn: func(m *mock.Mock, input runtime.Object) {
					m.On("Create", context.Background(), input, mock.Anything, mock.Anything).Return(exampleObj, nil)
				},
				setupLegacyFn: func(m *mock.Mock, input runtime.Object) {
					m.On("Create", context.Background(), input, mock.Anything, mock.Anything).Return(nil, errors.New("error"))
				},
				wantErr: true,
			},
			{
				name:  "error when creating object fails in both",
				input: failingObj,
				setupStorageFn: func(m *mock.Mock, input runtime.Object) {
					m.On("Create", context.Background(), input, mock.Anything, mock.Anything).Return(nil, errors.New("error"))
				},
				setupLegacyFn: func(m *mock.Mock, input runtime.Object) {
					m.On("Create", context.Background(), input, mock.Anything, mock.Anything).Return(nil, errors.New("error"))
				},
				wantErr: true,
			},
		}

	for _, tt := range tests {
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

		dw := SelectDualWriter(Mode3, ls, us)

		obj, err := dw.Create(context.Background(), tt.input, createFn, &metav1.CreateOptions{})

		if tt.wantErr {
			assert.Error(t, err)
			continue
		}

		assert.Equal(t, obj, exampleObj)
		accessor, err := meta.Accessor(obj)
		assert.NoError(t, err)
		assert.Equal(t, accessor.GetResourceVersion(), "")
	}
}

func TestMode3_Get(t *testing.T) {
	type testCase struct {
		name           string
		input          string
		setupLegacyFn  func(m *mock.Mock, input string)
		setupStorageFn func(m *mock.Mock, input string)
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name:  "getting an object from storage",
				input: "foo",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Get", context.Background(), input, mock.Anything).Return(anotherObj, nil)
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Get", context.Background(), input, mock.Anything).Return(exampleObj, nil)
				},
			},
			// {
			// 	name:  "error when creating object in storage fails",
			// 	input: failingObj,
			// 	setupStorageFn: func(m *mock.Mock, input runtime.Object) {
			// 		m.On("Create", context.Background(), input, mock.Anything, mock.Anything).Return(nil, errors.New("error"))
			// 	},
			// 	wantErr: true,
			// },
			// {
			// 	name:  "error when creating object in legacy storage fails",
			// 	input: failingObj,
			// 	setupStorageFn: func(m *mock.Mock, input runtime.Object) {
			// 		m.On("Create", context.Background(), input, mock.Anything, mock.Anything).Return(exampleObj, nil)
			// 	},
			// 	setupLegacyFn: func(m *mock.Mock, input runtime.Object) {
			// 		m.On("Create", context.Background(), input, mock.Anything, mock.Anything).Return(nil, errors.New("error"))
			// 	},
			// 	wantErr: true,
			// },
			// {
			// 	name:  "error when creating object fails in both",
			// 	input: failingObj,
			// 	setupStorageFn: func(m *mock.Mock, input runtime.Object) {
			// 		m.On("Create", context.Background(), input, mock.Anything, mock.Anything).Return(nil, errors.New("error"))
			// 	},
			// 	setupLegacyFn: func(m *mock.Mock, input runtime.Object) {
			// 		m.On("Create", context.Background(), input, mock.Anything, mock.Anything).Return(nil, errors.New("error"))
			// 	},
			// 	wantErr: true,
			// },
		}

	for _, tt := range tests {
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

		dw := SelectDualWriter(Mode3, ls, us)

		obj, err := dw.Get(context.Background(), tt.input, &metav1.GetOptions{})

		if tt.wantErr {
			assert.Error(t, err)
			continue
		}

		assert.Equal(t, obj, exampleObj)
		accessor, err := meta.Accessor(obj)
		assert.NoError(t, err)
		assert.Equal(t, accessor.GetResourceVersion(), "")
	}
}

// 	// Get: it should use the Storage Get implementation
// 	_, err = dw.Get(context.Background(), kind, &metav1.GetOptions{})
// 	assert.NoError(t, err)
// 	assert.Equal(t, 0, lsSpy.Counts("LegacyStorage.Get"))
// 	assert.Equal(t, 1, sSpy.Counts("Storage.Get"))

// 	// List: it should use the Storage List implementation
// 	_, err = dw.List(context.Background(), &metainternalversion.ListOptions{})
// 	assert.NoError(t, err)
// 	assert.Equal(t, 0, lsSpy.Counts("LegacyStorage.List"))
// 	assert.Equal(t, 1, sSpy.Counts("Storage.List"))

// // Delete: it should use call both Legacy and Storage Delete methods
// var deleteValidation = func(ctx context.Context, obj runtime.Object) error { return nil }
// _, _, err = dw.Delete(context.Background(), kind, deleteValidation, &metav1.DeleteOptions{})
// assert.NoError(t, err)
// assert.Equal(t, 1, lsSpy.Counts("LegacyStorage.Delete"))
// assert.Equal(t, 1, sSpy.Counts("Storage.Delete"))
