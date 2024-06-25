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
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apiserver/pkg/apis/example"
)

var createFn = func(context.Context, runtime.Object) error { return nil }

var exampleOption = &metainternalversion.ListOptions{}

func TestMode2_Create(t *testing.T) {
	type testCase struct {
		input          runtime.Object
		setupLegacyFn  func(m *mock.Mock, input runtime.Object)
		setupStorageFn func(m *mock.Mock, input runtime.Object)
		name           string
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name:  "creating an object in both the LegacyStorage and Storage",
				input: exampleObj,
				setupLegacyFn: func(m *mock.Mock, input runtime.Object) {
					m.On("Create", mock.Anything, input, mock.Anything, mock.Anything).Return(exampleObj, nil)
				},
				setupStorageFn: func(m *mock.Mock, input runtime.Object) {
					m.On("Create", mock.Anything, input, mock.Anything, mock.Anything).Return(exampleObj, nil)
				},
			},
			{
				name:  "error when creating object in the legacy store fails",
				input: failingObj,
				setupLegacyFn: func(m *mock.Mock, input runtime.Object) {
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

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(m, tt.input)
			}
			if tt.setupStorageFn != nil {
				tt.setupStorageFn(m, tt.input)
			}

			dw := NewDualWriter(Mode2, ls, us, p)

			obj, err := dw.Create(context.Background(), tt.input, createFn, &metav1.CreateOptions{})

			if tt.wantErr {
				assert.Error(t, err)
				return
			}

			assert.Equal(t, exampleObj, obj)
			accessor, err := meta.Accessor(obj)
			assert.NoError(t, err)
			assert.Equal(t, accessor.GetResourceVersion(), "1")
		})
	}
}

func TestMode2_Get(t *testing.T) {
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
				name:  "getting an object from storage",
				input: "foo",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Get", mock.Anything, input, mock.Anything).Return(exampleObj, nil)
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Get", mock.Anything, input, mock.Anything).Return(anotherObj, nil)
				},
			},
			{
				name:  "object not present in storage but present in legacy store",
				input: "foo",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Get", mock.Anything, input, mock.Anything).Return(exampleObj, nil)
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Get", mock.Anything, input, mock.Anything).Return(nil, errors.New("error"))
				},
			},
			{
				name:  "error when getting object in both stores fails",
				input: "object-fail",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Get", mock.Anything, input, mock.Anything).Return(nil, errors.New("error"))
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Get", mock.Anything, input, mock.Anything).Return(nil, errors.New("error"))
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

			dw := NewDualWriter(Mode2, ls, us, p)

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

func TestMode2_List(t *testing.T) {
	type testCase struct {
		inputLegacy    *metainternalversion.ListOptions
		setupLegacyFn  func(m *mock.Mock)
		setupStorageFn func(m *mock.Mock)
		name           string
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name:        "object present in both Storage and LegacyStorage",
				inputLegacy: exampleOption,
				setupLegacyFn: func(m *mock.Mock) {
					m.On("List", mock.Anything, mock.Anything).Return(exampleList, nil)
				},
				setupStorageFn: func(m *mock.Mock) {
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
			if tt.setupStorageFn != nil {
				tt.setupStorageFn(m)
			}

			dw := NewDualWriter(Mode2, ls, us, p)

			obj, err := dw.List(context.Background(), &metainternalversion.ListOptions{})

			if tt.wantErr {
				assert.Error(t, err)
				return
			}
			assert.Equal(t, exampleList, obj)
		})
	}
}

func TestMode2_Delete(t *testing.T) {
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
				name:  "delete in legacy and storage",
				input: "foo",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Delete", mock.Anything, input, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Delete", mock.Anything, input, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
			},
			{
				name:  "object delete in legacy not found, but found in storage",
				input: "foo",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Delete", mock.Anything, "not-found-legacy", mock.Anything, mock.Anything).Return(nil, false, apierrors.NewNotFound(schema.GroupResource{Group: "", Resource: "pods"}, "not-found"))
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Delete", mock.Anything, input, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
			},
			{
				name:  " object delete in storage not found, but found in legacy",
				input: "foo",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Delete", mock.Anything, input, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Delete", mock.Anything, "not-found-storage", mock.Anything, mock.Anything).Return(nil, false, apierrors.NewNotFound(schema.GroupResource{Group: "", Resource: "pods"}, "not-found"))
				},
			},
			{
				name:  " object not found in both",
				input: "object-fail",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Delete", mock.Anything, input, mock.Anything, mock.Anything).Return(nil, false, apierrors.NewNotFound(schema.GroupResource{Group: "", Resource: "pods"}, "not-found"))
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Delete", mock.Anything, input, mock.Anything, mock.Anything).Return(nil, false, apierrors.NewNotFound(schema.GroupResource{Group: "", Resource: "pods"}, "not-found"))
				},
				wantErr: true,
			},
			{
				name:  " object delete error",
				input: "object-fail",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Delete", mock.Anything, input, mock.Anything, mock.Anything).Return(nil, false, errors.New("error"))
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Delete", mock.Anything, input, mock.Anything, mock.Anything).Return(nil, false, errors.New("error"))
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

			dw := NewDualWriter(Mode2, ls, us, p)

			obj, _, err := dw.Delete(context.Background(), tt.input, func(context.Context, runtime.Object) error { return nil }, &metav1.DeleteOptions{})

			if tt.wantErr {
				assert.Error(t, err)
				return
			}

			assert.Equal(t, obj, exampleObj)
			assert.NotEqual(t, obj, anotherObj)
		})
	}
}

func TestMode2_DeleteCollection(t *testing.T) {
	type testCase struct {
		setupLegacyFn  func(m *mock.Mock)
		setupStorageFn func(m *mock.Mock)
		name           string
		input          string
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name:  "deleting a collection in both stores",
				input: "foo",
				setupLegacyFn: func(m *mock.Mock) {
					m.On("DeleteCollection", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleList, nil)
				},
				setupStorageFn: func(m *mock.Mock) {
					m.On("DeleteCollection", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleList, nil)
				},
			},
			{
				name:  "error deleting a collection in the storage when legacy store is successful",
				input: "foo",
				setupLegacyFn: func(m *mock.Mock) {
					m.On("DeleteCollection", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObj, nil)
				},
				setupStorageFn: func(m *mock.Mock) {
					m.On("DeleteCollection", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, errors.New("error"))
				},
				wantErr: true,
			},
			{
				name:  "deleting a collection when error in legacy store",
				input: "fail",
				setupLegacyFn: func(m *mock.Mock) {
					m.On("DeleteCollection", mock.Anything, mock.Anything, &metav1.DeleteOptions{TypeMeta: metav1.TypeMeta{Kind: "fail"}}, mock.Anything).Return(nil, errors.New("error"))
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
				tt.setupLegacyFn(m)
			}
			if tt.setupStorageFn != nil {
				tt.setupStorageFn(m)
			}

			dw := NewDualWriter(Mode2, ls, us, p)

			obj, err := dw.DeleteCollection(context.Background(), func(ctx context.Context, obj runtime.Object) error { return nil }, &metav1.DeleteOptions{TypeMeta: metav1.TypeMeta{Kind: tt.input}}, &metainternalversion.ListOptions{})

			if tt.wantErr {
				assert.Error(t, err)
				return
			}
			assert.Equal(t, exampleList, obj)
		})
	}
}

func TestMode2_Update(t *testing.T) {
	type testCase struct {
		expectedObj    runtime.Object
		setupLegacyFn  func(m *mock.Mock, input string)
		setupStorageFn func(m *mock.Mock, input string)
		setupGetFn     func(m *mock.Mock, input string)
		name           string
		input          string
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name:  "update an object in both stores",
				input: "foo",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Update", mock.Anything, input, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Update", mock.Anything, input, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
				setupGetFn: func(m *mock.Mock, input string) {
					m.On("Get", mock.Anything, input, mock.Anything).Return(exampleObj, nil)
				},
				expectedObj: exampleObj,
			},
			{
				name:  "object is not found in storage",
				input: "not-found",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Update", mock.Anything, input, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Update", mock.Anything, input, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
				setupGetFn: func(m *mock.Mock, input string) {
					m.On("Get", mock.Anything, input, mock.Anything).Return(nil, apierrors.NewNotFound(schema.GroupResource{Group: "", Resource: "pods"}, "not found"))
				},
				expectedObj: exampleObj,
			},
			{
				name:  "error finding object storage",
				input: "object-fail",
				setupGetFn: func(m *mock.Mock, input string) {
					m.On("Get", mock.Anything, input, mock.Anything).Return(nil, errors.New("error"))
				},
				wantErr: true,
			},
			{
				name:  "error updating legacy store",
				input: "object-fail",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Update", mock.Anything, input, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, false, errors.New("error"))
				},
				setupGetFn: func(m *mock.Mock, input string) {
					m.On("Get", mock.Anything, input, mock.Anything).Return(exampleObjDifferentRV, nil)
				},
				wantErr: true,
			},
			{
				name:  "error updating storage with not found object",
				input: "not-found",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Update", mock.Anything, input, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Update", mock.Anything, input, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, false, errors.New("error"))
				},
				setupGetFn: func(m *mock.Mock, input string) {
					m.On("Get", mock.Anything, input, mock.Anything).Return(nil, errors.New(""))
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

			if tt.setupGetFn != nil {
				tt.setupGetFn(m, tt.input)
			}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(m, tt.input)
			}
			if tt.setupStorageFn != nil {
				tt.setupStorageFn(m, tt.input)
			}

			dw := NewDualWriter(Mode2, ls, us, p)

			obj, _, err := dw.Update(context.Background(), tt.input, updatedObjInfoObj{}, func(ctx context.Context, obj runtime.Object) error { return nil }, func(ctx context.Context, obj, old runtime.Object) error { return nil }, false, &metav1.UpdateOptions{})

			if tt.wantErr {
				assert.Error(t, err)
				return
			}

			assert.Equal(t, tt.expectedObj, obj)
			assert.NotEqual(t, anotherObj, obj)
		})
	}
}
func TestEnrichReturnedObject(t *testing.T) {
	testCase := []struct {
		inputOriginal  runtime.Object
		inputReturned  runtime.Object
		expectedObject runtime.Object
		name           string
		isCreated      bool
		wantErr        bool
	}{
		{
			name: "original object does not have labels and annotations",
			inputOriginal: &example.Pod{
				TypeMeta:   metav1.TypeMeta{Kind: "foo"},
				ObjectMeta: metav1.ObjectMeta{Name: "foo", ResourceVersion: "1", UID: types.UID("5")},
				Spec:       example.PodSpec{}, Status: example.PodStatus{},
			},
			inputReturned: &example.Pod{
				TypeMeta:   metav1.TypeMeta{Kind: "foo"},
				ObjectMeta: metav1.ObjectMeta{Name: "foo", ResourceVersion: "2", UID: types.UID("6"), Labels: map[string]string{"label1": "1"}, Annotations: map[string]string{"annotation1": "1"}},
				Spec:       example.PodSpec{}, Status: example.PodStatus{},
			},
			expectedObject: &example.Pod{
				TypeMeta:   metav1.TypeMeta{Kind: "foo"},
				ObjectMeta: metav1.ObjectMeta{Name: "foo", ResourceVersion: "1", UID: types.UID("5")},
				Spec:       example.PodSpec{}, Status: example.PodStatus{},
			},
		},
		{
			name: "returned object does not have labels and annotations",
			inputOriginal: &example.Pod{
				TypeMeta:   metav1.TypeMeta{Kind: "foo"},
				ObjectMeta: metav1.ObjectMeta{Name: "foo", ResourceVersion: "1", UID: types.UID("5"), Labels: map[string]string{"label1": "1"}, Annotations: map[string]string{"annotation1": "1"}},
				Spec:       example.PodSpec{}, Status: example.PodStatus{},
			},
			inputReturned: &example.Pod{
				TypeMeta:   metav1.TypeMeta{Kind: "foo"},
				ObjectMeta: metav1.ObjectMeta{Name: "foo", ResourceVersion: "2", UID: types.UID("6")},
				Spec:       example.PodSpec{}, Status: example.PodStatus{},
			},
			expectedObject: &example.Pod{
				TypeMeta:   metav1.TypeMeta{Kind: "foo"},
				ObjectMeta: metav1.ObjectMeta{Name: "foo", ResourceVersion: "1", UID: types.UID("5"), Labels: map[string]string{"label1": "1"}, Annotations: map[string]string{"annotation1": "1"}},
				Spec:       example.PodSpec{}, Status: example.PodStatus{},
			},
		},
		{
			name: "both objects have labels and annotations",
			inputOriginal: &example.Pod{
				TypeMeta:   metav1.TypeMeta{Kind: "foo"},
				ObjectMeta: metav1.ObjectMeta{Name: "foo", ResourceVersion: "1", UID: types.UID("5"), Labels: map[string]string{"label1": "1"}, Annotations: map[string]string{"annotation1": "1"}},
				Spec:       example.PodSpec{}, Status: example.PodStatus{},
			},
			inputReturned: &example.Pod{
				TypeMeta:   metav1.TypeMeta{Kind: "foo"},
				ObjectMeta: metav1.ObjectMeta{Name: "foo", ResourceVersion: "2", UID: types.UID("6"), Labels: map[string]string{"label2": "2"}, Annotations: map[string]string{"annotation2": "2"}},
				Spec:       example.PodSpec{}, Status: example.PodStatus{},
			},
			expectedObject: &example.Pod{
				TypeMeta:   metav1.TypeMeta{Kind: "foo"},
				ObjectMeta: metav1.ObjectMeta{Name: "foo", ResourceVersion: "1", UID: types.UID("5"), Labels: map[string]string{"label1": "1"}, Annotations: map[string]string{"annotation1": "1"}},
				Spec:       example.PodSpec{}, Status: example.PodStatus{},
			},
		},
		{
			name: "both objects have labels and annotations with duplicated keys",
			inputOriginal: &example.Pod{
				TypeMeta:   metav1.TypeMeta{Kind: "foo"},
				ObjectMeta: metav1.ObjectMeta{Name: "foo", ResourceVersion: "1", UID: types.UID("5"), Labels: map[string]string{"label1": "1"}, Annotations: map[string]string{"annotation1": "1"}},
				Spec:       example.PodSpec{}, Status: example.PodStatus{},
			},
			inputReturned: &example.Pod{
				TypeMeta:   metav1.TypeMeta{Kind: "foo"},
				ObjectMeta: metav1.ObjectMeta{Name: "foo", ResourceVersion: "2", UID: types.UID("6"), Labels: map[string]string{"label1": "11"}, Annotations: map[string]string{"annotation1": "11"}},
				Spec:       example.PodSpec{}, Status: example.PodStatus{},
			},
			expectedObject: &example.Pod{
				TypeMeta:   metav1.TypeMeta{Kind: "foo"},
				ObjectMeta: metav1.ObjectMeta{Name: "foo", ResourceVersion: "1", UID: types.UID("5"), Labels: map[string]string{"label1": "1"}, Annotations: map[string]string{"annotation1": "1"}},
				Spec:       example.PodSpec{}, Status: example.PodStatus{},
			},
		},
		{
			name:           "original object does not exist",
			inputOriginal:  nil,
			inputReturned:  &example.Pod{},
			expectedObject: nil,
			wantErr:        true,
		},
		{
			name:           "returned object does not exist",
			inputOriginal:  &example.Pod{},
			inputReturned:  nil,
			expectedObject: nil,
			wantErr:        true,
		},
	}

	for _, tt := range testCase {
		t.Run(tt.name, func(t *testing.T) {
			err := enrichLegacyObject(tt.inputOriginal, tt.inputReturned)
			if tt.wantErr {
				assert.Error(t, err)
				return
			}

			accessorReturned, err := meta.Accessor(tt.inputReturned)
			assert.NoError(t, err)

			accessorExpected, err := meta.Accessor(tt.expectedObject)
			assert.NoError(t, err)

			assert.Equal(t, accessorExpected.GetLabels(), accessorReturned.GetLabels())

			returnedAnnotations := accessorReturned.GetAnnotations()
			expectedAnnotations := accessorExpected.GetAnnotations()
			for k, v := range expectedAnnotations {
				assert.Equal(t, v, returnedAnnotations[k])
			}

			assert.Equal(t, accessorExpected.GetResourceVersion(), accessorReturned.GetResourceVersion())
			assert.Equal(t, accessorExpected.GetUID(), accessorReturned.GetUID())
		})
	}
}
