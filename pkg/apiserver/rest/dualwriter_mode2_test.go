package rest

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

var createFn = func(context.Context, runtime.Object) error { return nil }
var exampleOption = &metainternalversion.ListOptions{
	TypeMeta: metav1.TypeMeta{
		APIVersion: "v1",
		Kind:       "foo",
	},
}

func TestMode2_Create(t *testing.T) {
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
				name:  "creating an object in both the LegacyStorage and Storage",
				input: exampleObj,
				setupLegacyFn: func(m *mock.Mock, input runtime.Object) {
					m.On("Create", context.Background(), input, mock.Anything, mock.Anything).Return(exampleObj, nil)
				},
				setupStorageFn: func(m *mock.Mock, input runtime.Object) {
					m.On("Create", context.Background(), input, mock.Anything, mock.Anything).Return(exampleObj, nil)
				},
			},
			{
				name:  "error when creating object in the legacy store fails",
				input: failingObj,
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

		dw := SelectDualWriter(Mode2, ls, us)

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

func TestMode2_Get(t *testing.T) {
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
					m.On("Get", context.Background(), input, mock.Anything).Return(exampleObj, nil)
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Get", context.Background(), input, mock.Anything).Return(anotherObj, nil)
				},
			},
			{
				name:  "object not present in storage but present in legacy store",
				input: "foo",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Get", context.Background(), input, mock.Anything).Return(exampleObj, nil)
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Get", context.Background(), input, mock.Anything).Return(nil, errors.New("error"))
				},
			},
			{
				name:  "error when getting object in both stores fails",
				input: "object-fail",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Get", context.Background(), input, mock.Anything).Return(nil, errors.New("error"))
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Get", context.Background(), input, mock.Anything).Return(nil, errors.New("error"))
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

		dw := SelectDualWriter(Mode2, ls, us)

		obj, err := dw.Get(context.Background(), tt.input, &metav1.GetOptions{})

		if tt.wantErr {
			assert.Error(t, err)
			continue
		}

		assert.Equal(t, obj, exampleObj)
		assert.NotEqual(t, obj, anotherObj)
	}
}

func TestMode2_List(t *testing.T) {
	type testCase struct {
		name           string
		input          *metainternalversion.ListOptions
		setupLegacyFn  func(m *mock.Mock, input *metainternalversion.ListOptions)
		setupStorageFn func(m *mock.Mock, input *metainternalversion.ListOptions)
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name:  "error when legacy list is not implmented",
				input: exampleOption,
				setupLegacyFn: func(m *mock.Mock, input *metainternalversion.ListOptions) {
					m.On("List", context.Background(), input).Return(exampleObj, nil)
				},
				setupStorageFn: func(m *mock.Mock, input *metainternalversion.ListOptions) {
					m.On("List", context.Background(), input).Return(exampleObj, nil)
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

		dw := SelectDualWriter(Mode2, ls, us)

		obj, err := dw.List(context.Background(), exampleOption)

		if tt.wantErr {
			assert.Error(t, err)
			continue
		}

		assert.Equal(t, obj, exampleObj)
	}
}

func TestMode2_Delete(t *testing.T) {
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
				name:  "delete in legacy and storage",
				input: "foo",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Delete", context.Background(), input, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Delete", context.Background(), input, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
			},
			{
				name:  "object delete in legacy not found, but found in storage",
				input: "foo",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Delete", context.Background(), "not-found-legacy", mock.Anything, mock.Anything).Return(nil, false, apierrors.NewNotFound(schema.GroupResource{Group: "", Resource: "pods"}, "not-found"))
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Delete", context.Background(), input, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
			},
			{
				name:  " object delete in storage not found, but found in legacy",
				input: "foo",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Delete", context.Background(), input, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Delete", context.Background(), "not-found-storage", mock.Anything, mock.Anything).Return(nil, false, apierrors.NewNotFound(schema.GroupResource{Group: "", Resource: "pods"}, "not-found"))
				},
			},
			{
				name:  " object not found in both",
				input: "object-fail",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Delete", context.Background(), input, mock.Anything, mock.Anything).Return(nil, false, apierrors.NewNotFound(schema.GroupResource{Group: "", Resource: "pods"}, "not-found"))
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Delete", context.Background(), input, mock.Anything, mock.Anything).Return(nil, false, apierrors.NewNotFound(schema.GroupResource{Group: "", Resource: "pods"}, "not-found"))
				},
				wantErr: true,
			},
			{
				name:  " object delete error",
				input: "object-fail",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Delete", context.Background(), input, mock.Anything, mock.Anything).Return(nil, false, errors.New("error"))
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Delete", context.Background(), input, mock.Anything, mock.Anything).Return(nil, false, errors.New("error"))
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

		dw := SelectDualWriter(Mode2, ls, us)

		obj, _, err := dw.Delete(context.Background(), tt.input, func(context.Context, runtime.Object) error { return nil }, &metav1.DeleteOptions{})

		if tt.wantErr {
			assert.Error(t, err)
			continue
		}

		assert.Equal(t, obj, exampleObj)
		assert.NotEqual(t, obj, anotherObj)
	}
}

func TestMode2_DeleteCollection(t *testing.T) {
	type testCase struct {
		name           string
		input          *metav1.DeleteOptions
		setupLegacyFn  func(m *mock.Mock, input *metav1.DeleteOptions)
		setupStorageFn func(m *mock.Mock, input *metav1.DeleteOptions)
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name:  "deleting a collection in both stores",
				input: &metav1.DeleteOptions{TypeMeta: metav1.TypeMeta{Kind: "foo"}},
				setupLegacyFn: func(m *mock.Mock, input *metav1.DeleteOptions) {
					m.On("DeleteCollection", context.Background(), mock.Anything, input, mock.Anything).Return(exampleObj, nil)
				},
				setupStorageFn: func(m *mock.Mock, input *metav1.DeleteOptions) {
					m.On("DeleteCollection", context.Background(), mock.Anything, input, mock.Anything).Return(exampleObj, nil)
				},
			},
			{
				name:  "error deleting a collection in the storage when legacy store is successful",
				input: &metav1.DeleteOptions{TypeMeta: metav1.TypeMeta{Kind: "fail"}},
				setupLegacyFn: func(m *mock.Mock, input *metav1.DeleteOptions) {
					m.On("DeleteCollection", context.Background(), mock.Anything, &metav1.DeleteOptions{TypeMeta: metav1.TypeMeta{Kind: "foo"}}, mock.Anything).Return(exampleObj, nil)
				},
				setupStorageFn: func(m *mock.Mock, input *metav1.DeleteOptions) {
					m.On("DeleteCollection", context.Background(), mock.Anything, input, mock.Anything).Return(nil, errors.New("error"))
				},
				wantErr: true,
			},
			{
				name:  "error deleting a collection when error in both stores",
				input: &metav1.DeleteOptions{TypeMeta: metav1.TypeMeta{Kind: "fail"}},
				setupLegacyFn: func(m *mock.Mock, input *metav1.DeleteOptions) {
					m.On("DeleteCollection", context.Background(), mock.Anything, input, mock.Anything).Return(nil, errors.New("error"))
				},
				setupStorageFn: func(m *mock.Mock, input *metav1.DeleteOptions) {
					m.On("DeleteCollection", context.Background(), mock.Anything, input, mock.Anything).Return(nil, errors.New("error"))
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

		dw := SelectDualWriter(Mode2, ls, us)

		obj, err := dw.DeleteCollection(context.Background(), func(ctx context.Context, obj runtime.Object) error { return nil }, tt.input, &metainternalversion.ListOptions{})

		if tt.wantErr {
			assert.Error(t, err)
			continue
		}

		us.AssertNotCalled(t, "DeleteCollection", context.Background(), tt.input, func(ctx context.Context, obj runtime.Object) error { return nil }, &metav1.DeleteOptions{})
		assert.Equal(t, obj, exampleObj)
		assert.NotEqual(t, obj, anotherObj)
	}
}
