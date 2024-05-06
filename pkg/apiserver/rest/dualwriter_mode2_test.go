package rest

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apiserver/pkg/apis/example"
)

var createFn = func(context.Context, runtime.Object) error { return nil }

var exampleOption = &metainternalversion.ListOptions{}

var legacyItem = example.Pod{
	TypeMeta: metav1.TypeMeta{},
	ObjectMeta: metav1.ObjectMeta{
		Name:            "foo",
		ResourceVersion: "1",
		Annotations: map[string]string{
			"grafana.app/originKey": "1",
		},
	},
	Spec:   example.PodSpec{},
	Status: example.PodStatus{},
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
	storageItem := legacyItem.DeepCopy()
	storageItem.Labels = map[string]string{"exampleLabel": "value"}

	legacyList := example.PodList{Items: []example.Pod{legacyItem}}
	storageList := example.PodList{Items: []example.Pod{*storageItem}}
	expectedList := storageList.DeepCopy()

	r, err := labels.NewRequirement(utils.AnnoKeyOriginKey, selection.In, []string{"1"})
	assert.NoError(t, err)
	storageOptions := &metainternalversion.ListOptions{
		LabelSelector: labels.NewSelector().Add(*r),
		TypeMeta:      metav1.TypeMeta{},
	}

	type testCase struct {
		name           string
		inputLegacy    *metainternalversion.ListOptions
		inputStorage   *metainternalversion.ListOptions
		setupLegacyFn  func(m *mock.Mock, input *metainternalversion.ListOptions)
		setupStorageFn func(m *mock.Mock, input *metainternalversion.ListOptions)
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name:         "object present in both Storage and LegacyStorage",
				inputLegacy:  exampleOption,
				inputStorage: storageOptions,
				setupLegacyFn: func(m *mock.Mock, input *metainternalversion.ListOptions) {
					m.On("List", context.Background(), input).Return(&legacyList, nil)
				},
				setupStorageFn: func(m *mock.Mock, input *metainternalversion.ListOptions) {
					m.On("List", context.Background(), input).Return(&storageList, nil)
				},
			},
		}

	for _, tt := range tests {
		l := (LegacyStorage)(nil)
		s := (Storage)(nil)
		m := &mock.Mock{}

		ls := legacyStoreMock{m, l}
		us := storageMock{m, s}

		if tt.setupLegacyFn != nil {
			tt.setupLegacyFn(m, tt.inputLegacy)
		}
		if tt.setupStorageFn != nil {
			tt.setupStorageFn(m, tt.inputStorage)
		}

		dw := SelectDualWriter(Mode2, ls, us)

		obj, err := dw.List(context.Background(), exampleOption)

		if tt.wantErr {
			assert.Error(t, err)
			continue
		}

		assert.Equal(t, expectedList, obj)
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
	storageItem := legacyItem.DeepCopy()
	storageItem.Labels = map[string]string{"exampleLabel": "value"}

	legacyList := example.PodList{Items: []example.Pod{legacyItem}}
	storageList := example.PodList{Items: []example.Pod{*storageItem}}
	expectedList := storageList.DeepCopy()

	r, err := labels.NewRequirement(utils.AnnoKeyOriginKey, selection.In, []string{"1"})
	assert.NoError(t, err)
	storageOptions := &metainternalversion.ListOptions{
		LabelSelector: labels.NewSelector().Add(*r),
		TypeMeta:      metav1.TypeMeta{},
	}

	type testCase struct {
		name           string
		legacyInput    *metainternalversion.ListOptions
		storageInput   *metainternalversion.ListOptions
		setupLegacyFn  func(m *mock.Mock, input *metainternalversion.ListOptions)
		setupStorageFn func(m *mock.Mock, input *metainternalversion.ListOptions)
		wantErr        bool
		expectedList   *example.PodList
	}
	tests :=
		[]testCase{
			{
				name:         "deleting a collection in both stores",
				legacyInput:  exampleOption,
				storageInput: storageOptions,
				setupLegacyFn: func(m *mock.Mock, input *metainternalversion.ListOptions) {
					m.On("DeleteCollection", context.Background(), mock.Anything, mock.Anything, input).Return(&legacyList, nil)
				},
				setupStorageFn: func(m *mock.Mock, input *metainternalversion.ListOptions) {
					m.On("DeleteCollection", context.Background(), mock.Anything, mock.Anything, input).Return(&storageList, nil)
				},
				expectedList: expectedList,
			},
			{
				name: "error deleting a collection in the storage when legacy store is successful",
				setupLegacyFn: func(m *mock.Mock, input *metainternalversion.ListOptions) {
					m.On("DeleteCollection", context.Background(), mock.Anything, mock.Anything, input).Return(exampleObj, nil)
				},
				setupStorageFn: func(m *mock.Mock, input *metainternalversion.ListOptions) {
					m.On("DeleteCollection", context.Background(), mock.Anything, mock.Anything, input).Return(nil, errors.New("error"))
				},
				wantErr:      true,
				expectedList: &example.PodList{},
			},
			{
				name: "deleting a collection when error in both stores",
				setupLegacyFn: func(m *mock.Mock, input *metainternalversion.ListOptions) {
					m.On("DeleteCollection", context.Background(), mock.Anything, mock.Anything, input).Return(&example.PodList{}, errors.New("error"))
				},
				setupStorageFn: func(m *mock.Mock, input *metainternalversion.ListOptions) {
					m.On("DeleteCollection", context.Background(), mock.Anything, mock.Anything, input).Return(&example.PodList{}, errors.New("error"))
				},
				expectedList: &example.PodList{},
			},
		}

	for _, tt := range tests {
		l := (LegacyStorage)(nil)
		s := (Storage)(nil)
		m := &mock.Mock{}

		ls := legacyStoreMock{m, l}
		us := storageMock{m, s}

		if tt.setupLegacyFn != nil {
			tt.setupLegacyFn(m, tt.legacyInput)
		}
		if tt.setupStorageFn != nil {
			tt.setupStorageFn(m, tt.storageInput)
		}

		dw := SelectDualWriter(Mode2, ls, us)

		obj, err := dw.DeleteCollection(context.Background(), func(ctx context.Context, obj runtime.Object) error { return nil }, &metav1.DeleteOptions{}, tt.legacyInput)

		if tt.wantErr {
			assert.Error(t, err)
			continue
		}

		assert.Equal(t, tt.expectedList, obj)
	}
}

func TestMode2_Update(t *testing.T) {
	type testCase struct {
		name           string
		input          string
		setupLegacyFn  func(m *mock.Mock, input string)
		setupStorageFn func(m *mock.Mock, input string)
		setupGetFn     func(m *mock.Mock, input string)
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name:  "update an object in both stores",
				input: "foo",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Update", context.Background(), input, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Update", context.Background(), input, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
				setupGetFn: func(m *mock.Mock, input string) {
					m.On("Get", context.Background(), input, mock.Anything).Return(exampleObjDifferentRV, nil)
				},
			},
			{
				name:  "object is not found in storage",
				input: "not-found",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Update", context.Background(), input, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Update", context.Background(), input, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
				setupGetFn: func(m *mock.Mock, input string) {
					m.On("Get", context.Background(), input, mock.Anything).Return(nil, apierrors.NewNotFound(schema.GroupResource{Group: "", Resource: "pods"}, "not found"))
				},
			},
			{
				name:  "error finding object storage",
				input: "object-fail",
				setupGetFn: func(m *mock.Mock, input string) {
					m.On("Get", context.Background(), input, mock.Anything).Return(nil, errors.New("error"))
				},
				wantErr: true,
			},
			{
				name:  "error updating legacy store",
				input: "object-fail",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Update", context.Background(), input, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, false, errors.New("error"))
				},
				setupGetFn: func(m *mock.Mock, input string) {
					m.On("Get", context.Background(), input, mock.Anything).Return(exampleObjDifferentRV, nil)
				},
				wantErr: true,
			},
			{
				name:  "error updating storage",
				input: "object-fail",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Update", context.Background(), input, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Update", context.Background(), input, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, false, errors.New("error"))
				},
				setupGetFn: func(m *mock.Mock, input string) {
					m.On("Get", context.Background(), input, mock.Anything).Return(exampleObj, nil)
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

		if tt.setupGetFn != nil {
			tt.setupGetFn(m, tt.input)
		}

		if tt.setupLegacyFn != nil {
			tt.setupLegacyFn(m, tt.input)
		}
		if tt.setupStorageFn != nil {
			tt.setupStorageFn(m, tt.input)
		}

		dw := SelectDualWriter(Mode2, ls, us)

		obj, _, err := dw.Update(context.Background(), tt.input, UpdatedObjInfoObj{}, func(ctx context.Context, obj runtime.Object) error { return nil }, func(ctx context.Context, obj, old runtime.Object) error { return nil }, false, &metav1.UpdateOptions{})

		if tt.wantErr {
			assert.Error(t, err)
			continue
		}

		assert.Equal(t, obj, exampleObj)
		assert.NotEqual(t, obj, anotherObj)
	}
}
