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

func TestMode2(t *testing.T) {
	var ls = (LegacyStorage)(nil)
	var s = (Storage)(nil)
	lsSpy := NewLegacyStorageSpyClient(ls)
	sSpy := NewStorageSpyClient(s)

	dw := NewDualWriterMode2(lsSpy, sSpy)

	// Create: it should use the Legacy Create implementation
	_, err := dw.Create(context.Background(), &dummyObject{}, func(context.Context, runtime.Object) error { return nil }, &metav1.CreateOptions{})
	assert.NoError(t, err)
	assert.Equal(t, 1, lsSpy.Counts("LegacyStorage.Create"))
	assert.Equal(t, 1, sSpy.Counts("Storage.Create"))

	// Get: it should read from Storage with LegacyStorage as a fallback
	// #TODO: Currently only testing the happy path. Refactor testing to more easily test other cases.
	_, err = dw.Get(context.Background(), kind, &metav1.GetOptions{})
	assert.NoError(t, err)
	assert.Equal(t, 0, lsSpy.Counts("LegacyStorage.Get"))
	assert.Equal(t, 1, sSpy.Counts("Storage.Get"))

	// List: it should use call both Legacy and Storage List methods
	l, err := dw.List(context.Background(), &metainternalversion.ListOptions{})
	assert.NoError(t, err)
	assert.Equal(t, 1, lsSpy.Counts("LegacyStorage.List"))
	assert.Equal(t, 1, sSpy.Counts("Storage.List"))

	resList, err := meta.ExtractList(l)
	assert.NoError(t, err)

	expectedItems := map[string]string{
		// Item 1: Storage should override Legacy
		"Item 1": "Storage field 1",
		// Item 2 shouldn't be included because it's not in Storage
		// Item 3 should because it's in Legacy
		"Item 3": "Legacy field 3",
	}

	assert.Equal(t, len(expectedItems), len(resList))

	for _, obj := range resList {
		v, ok := obj.(*dummyObject)
		assert.True(t, ok)
		accessor, err := meta.Accessor(v)
		assert.NoError(t, err)

		k, ok := expectedItems[accessor.GetName()]
		assert.True(t, ok)
		assert.Equal(t, k, v.Foo)
	}

	// Delete: it should use call both Legacy and Storage Delete methods
	var deleteValidation = func(ctx context.Context, obj runtime.Object) error { return nil }
	_, _, err = dw.Delete(context.Background(), kind, deleteValidation, &metav1.DeleteOptions{})
	assert.NoError(t, err)
	assert.Equal(t, 1, lsSpy.Counts("LegacyStorage.Delete"))
	assert.Equal(t, 1, sSpy.Counts("Storage.Delete"))

	// DeleteCollection: it should delete from both LegacyStorage and Storage
	_, err = dw.DeleteCollection(
		context.Background(),
		func(context.Context, runtime.Object) error { return nil },
		&metav1.DeleteOptions{},
		&metainternalversion.ListOptions{},
	)
	assert.NoError(t, err)
	assert.Equal(t, 1, lsSpy.Counts("LegacyStorage.DeleteCollection"))
	assert.Equal(t, 1, sSpy.Counts("Storage.DeleteCollection"))
}

var createFn = func(context.Context, runtime.Object) error { return nil }
var exampleOption = &metainternalversion.ListOptions{
	TypeMeta: metav1.TypeMeta{
		APIVersion: "v1",
		Kind:       "foo",
	},
}

func TestMode2_Create(t *testing.T) {
	type testCase struct {
		name          string
		input         runtime.Object
		setupLegacyFn func(m *mock.Mock, input runtime.Object)
		setupUSFn     func(m *mock.Mock, input runtime.Object)
		wantErr       bool
	}
	tests :=
		[]testCase{
			{
				name:  "creating an object in both the legacy and unified store",
				input: exampleObj,
				setupLegacyFn: func(m *mock.Mock, input runtime.Object) {
					m.On("Create", context.Background(), input, mock.Anything, mock.Anything).Return(exampleObj, nil)
				},
				setupUSFn: func(m *mock.Mock, input runtime.Object) {
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
		us := unifiedStoreMock{m, s}

		if tt.setupLegacyFn != nil {
			tt.setupLegacyFn(m, tt.input)
		}
		if tt.setupUSFn != nil {
			tt.setupUSFn(m, tt.input)
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
		name          string
		input         string
		setupLegacyFn func(m *mock.Mock, input string)
		setupUSFn     func(m *mock.Mock, input string)
		wantErr       bool
	}
	tests :=
		[]testCase{
			{
				name:  "getting an object from storage",
				input: "foo",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Get", context.Background(), input, mock.Anything).Return(exampleObj, nil)
				},
			},
			{
				name:  "object not present in storage but present in legacy store",
				input: "foo",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Get", context.Background(), input, mock.Anything).Return(exampleObj, nil)
				},
				setupUSFn: func(m *mock.Mock, input string) {
					m.On("Get", context.Background(), input, mock.Anything).Return(nil, errors.New("error"))
				},
			},
			{
				name:  "error when getting object in both stores fails",
				input: "object-fail",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Get", context.Background(), input, mock.Anything).Return(nil, errors.New("error"))
				},
				setupUSFn: func(m *mock.Mock, input string) {
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
		us := unifiedStoreMock{m, s}

		if tt.setupLegacyFn != nil {
			tt.setupLegacyFn(m, tt.input)
		}
		if tt.setupUSFn != nil {
			tt.setupUSFn(m, tt.input)
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
		name          string
		input         *metainternalversion.ListOptions
		setupLegacyFn func(m *mock.Mock, input *metainternalversion.ListOptions)
		setupUSFn     func(m *mock.Mock, input *metainternalversion.ListOptions)
		wantErr       bool
	}
	tests :=
		[]testCase{
			{
				name:  "error when legacy list is not implmented",
				input: exampleOption,
				setupLegacyFn: func(m *mock.Mock, input *metainternalversion.ListOptions) {
					m.On("List", context.Background(), input).Return(exampleObj, nil)
				},
				setupUSFn: func(m *mock.Mock, input *metainternalversion.ListOptions) {
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
		us := unifiedStoreMock{m, s}

		if tt.setupLegacyFn != nil {
			tt.setupLegacyFn(m, tt.input)
		}
		if tt.setupUSFn != nil {
			tt.setupUSFn(m, tt.input)
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
		name          string
		input         string
		setupLegacyFn func(m *mock.Mock, input string)
		setupUSFn     func(m *mock.Mock, input string)
		wantErr       bool
	}
	tests :=
		[]testCase{
			{
				name:  "delete in legacy and storage",
				input: "foo",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Delete", context.Background(), input, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
				setupUSFn: func(m *mock.Mock, input string) {
					m.On("Delete", context.Background(), input, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
			},
			{
				name:  " object delete in legacy not found, but found in storage",
				input: "foo",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Delete", context.Background(), "not-found-legacy", mock.Anything, mock.Anything).Return(nil, false, apierrors.NewNotFound(schema.GroupResource{Group: "", Resource: "pods"}, "not-found"))
				},
				setupUSFn: func(m *mock.Mock, input string) {
					m.On("Delete", context.Background(), input, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
			},
			{
				name:  " object delete in storage not found, but found in legacy",
				input: "foo",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Delete", context.Background(), input, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
				setupUSFn: func(m *mock.Mock, input string) {
					m.On("Delete", context.Background(), "not-found-storage", mock.Anything, mock.Anything).Return(nil, false, apierrors.NewNotFound(schema.GroupResource{Group: "", Resource: "pods"}, "not-found"))
				},
			},
			{
				name:  " object not found in both",
				input: "object-fail",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Delete", context.Background(), input, mock.Anything, mock.Anything).Return(nil, false, apierrors.NewNotFound(schema.GroupResource{Group: "", Resource: "pods"}, "not-found"))
				},
				setupUSFn: func(m *mock.Mock, input string) {
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
				setupUSFn: func(m *mock.Mock, input string) {
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
		us := unifiedStoreMock{m, s}

		if tt.setupLegacyFn != nil {
			tt.setupLegacyFn(m, tt.input)
		}
		if tt.setupUSFn != nil {
			tt.setupUSFn(m, tt.input)
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
