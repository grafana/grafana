package dualwrite

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apiserver/rest"
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
				name:  "should create an object in both the LegacyStorage and Storage",
				input: exampleObj,
				setupLegacyFn: func(m *mock.Mock, input runtime.Object) {
					m.On("Create", mock.Anything, input, mock.Anything, mock.Anything).Return(exampleObj, nil)
				},
				setupStorageFn: func(m *mock.Mock, _ runtime.Object) {
					// We don't use the input here, as the input is transformed before being passed to unified storage.
					m.On("Create", mock.Anything, exampleObjNoRV, mock.Anything, mock.Anything).Return(exampleObj, nil)
				},
			},
			{
				name:  "should return an error when creating an object in the LegacyStorage fails",
				input: failingObj,
				setupLegacyFn: func(m *mock.Mock, input runtime.Object) {
					m.On("Create", mock.Anything, input, mock.Anything, mock.Anything).Return(nil, errors.New("error"))
				},
				setupStorageFn: func(m *mock.Mock, input runtime.Object) {
					m.On("Create", mock.Anything, input, mock.Anything, mock.Anything).Return(exampleObj, nil)
				},
				wantErr: true,
			},
		}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l := (rest.Storage)(nil)
			s := (rest.Storage)(nil)

			ls := storageMock{&mock.Mock{}, l}
			us := storageMock{&mock.Mock{}, s}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(ls.Mock, tt.input)
			}
			if tt.setupStorageFn != nil {
				tt.setupStorageFn(us.Mock, tt.input)
			}

			dw, err := NewDualWriter(kind, rest.Mode2, ls, us)
			require.NoError(t, err)

			obj, err := dw.Create(context.Background(), tt.input, createFn, &metav1.CreateOptions{})

			if tt.wantErr {
				require.Error(t, err)
				return
			}

			require.Equal(t, exampleObj, obj)
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
				name:  "should get an object from both the LegacyStorage and Storage",
				input: "foo",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Get", mock.Anything, input, mock.Anything).Return(exampleObj, nil)
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Get", mock.Anything, input, mock.Anything).Return(anotherObj, nil)
				},
			},
			{
				name:  "should return an error when getting an object from the Storage fails",
				input: "foo",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Get", mock.Anything, input, mock.Anything).Return(exampleObj, nil)
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Get", mock.Anything, input, mock.Anything).Return(nil, errors.New("error"))
				},
				wantErr: true,
			},
			{
				name:  "should not error when object is not found in the Storage but found in the LegacyStorage",
				input: "foo",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Get", mock.Anything, input, mock.Anything).Return(exampleObj, nil)
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Get", mock.Anything, input, mock.Anything).Return(nil, apierrors.NewNotFound(
						schema.GroupResource{Group: "", Resource: "pods"}, "not-found"))
				},
			},
			{
				name:  "should return an error when getting an object from both the LegacyStorage and Storage fails",
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
			l := (rest.Storage)(nil)
			s := (rest.Storage)(nil)

			ls := storageMock{&mock.Mock{}, l}
			us := storageMock{&mock.Mock{}, s}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(ls.Mock, tt.input)
			}
			if tt.setupStorageFn != nil {
				tt.setupStorageFn(us.Mock, tt.input)
			}

			dw, err := NewDualWriter(kind, rest.Mode2, ls, us)
			require.NoError(t, err)

			obj, err := dw.Get(context.Background(), tt.input, &metav1.GetOptions{})

			if tt.wantErr {
				require.Error(t, err)
				return
			}

			require.Equal(t, obj, exampleObj)
			require.NotEqual(t, obj, anotherObj)
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
				name:        "should return a list of objects from both the LegacyStorage and Storage",
				inputLegacy: exampleOption,
				setupLegacyFn: func(m *mock.Mock) {
					m.On("List", mock.Anything, mock.Anything).Return(exampleList, nil)
				},
				setupStorageFn: func(m *mock.Mock) {
					m.On("List", mock.Anything, mock.Anything).Return(anotherList, nil)
				},
			},
			{
				name:        "should return an error when listing objects from the LegacyStorage fails",
				inputLegacy: exampleOption,
				setupLegacyFn: func(m *mock.Mock) {
					m.On("List", mock.Anything, mock.Anything).Return(nil, errors.New("error"))
				},
				setupStorageFn: func(m *mock.Mock) {
					m.On("List", mock.Anything, mock.Anything).Return(anotherList, nil)
				},
				wantErr: true,
			},
			{
				name:        "should return an error when listing objects from the Storage fails",
				inputLegacy: exampleOption,
				setupLegacyFn: func(m *mock.Mock) {
					m.On("List", mock.Anything, mock.Anything).Return(exampleList, nil)
				},
				setupStorageFn: func(m *mock.Mock) {
					m.On("List", mock.Anything, mock.Anything).Return(nil, errors.New("error"))
				},
				wantErr: true,
			},
		}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l := (rest.Storage)(nil)
			s := (rest.Storage)(nil)

			ls := storageMock{&mock.Mock{}, l}
			us := storageMock{&mock.Mock{}, s}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(ls.Mock)
			}
			if tt.setupStorageFn != nil {
				tt.setupStorageFn(us.Mock)
			}

			dw, err := NewDualWriter(kind, rest.Mode2, ls, us)
			require.NoError(t, err)

			obj, err := dw.List(context.Background(), &metainternalversion.ListOptions{})

			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.Equal(t, exampleList, obj)
		})
	}
}

func TestMode2_Delete(t *testing.T) {
	type testCase struct {
		setupLegacyFn  func(m *mock.Mock, input string)
		setupStorageFn func(m *mock.Mock, input string)
		name           string
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name: "should delete an object from both the LegacyStorage and Storage",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Delete", mock.Anything, input, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Delete", mock.Anything, input, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
			},
			{
				name: "should return an error when deleting an object from the LegacyStorage fails",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Delete", mock.Anything, input, mock.Anything, mock.Anything).Return(nil, false, errors.New("error"))
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Delete", mock.Anything, input, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
				wantErr: true,
			},
			{
				name: "should return an error when deleting an object from the Storage fails",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Delete", mock.Anything, input, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Delete", mock.Anything, input, mock.Anything, mock.Anything).Return(nil, false, errors.New("error"))
				},
				wantErr: true,
			},
			{
				name: "should return an error when the object is not found in LegacyStorage",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Delete", mock.Anything, input, mock.Anything, mock.Anything).Return(nil, false,
						apierrors.NewNotFound(schema.GroupResource{Group: "", Resource: "pods"}, input))
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Delete", mock.Anything, input, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
				wantErr: true,
			},
			{
				name: "should not return an error when the object is not found in Storage",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Delete", mock.Anything, input, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Delete", mock.Anything, input, mock.Anything, mock.Anything).Return(nil, false,
						apierrors.NewNotFound(schema.GroupResource{Group: "", Resource: "pods"}, input))
				},
			},
			{
				name: "should return an error when deleting an object from both the LegacyStorage and Storage fails",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Delete", mock.Anything, input, mock.Anything, mock.Anything).Return(nil, false, errors.New("error"))
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Delete", mock.Anything, input, mock.Anything, mock.Anything).Return(nil, false, errors.New("error"))
				},
				wantErr: true,
			},
		}

	name := "foo"

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l := (rest.Storage)(nil)
			s := (rest.Storage)(nil)

			ls := storageMock{&mock.Mock{}, l}
			us := storageMock{&mock.Mock{}, s}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(ls.Mock, name)
			}
			if tt.setupStorageFn != nil {
				tt.setupStorageFn(us.Mock, name)
			}

			dw, err := NewDualWriter(kind, rest.Mode2, ls, us)
			require.NoError(t, err)

			obj, _, err := dw.Delete(context.Background(), name, func(context.Context, runtime.Object) error { return nil }, &metav1.DeleteOptions{})

			if tt.wantErr {
				require.Error(t, err)
				return
			}

			require.Equal(t, obj, exampleObj)
			require.NotEqual(t, obj, anotherObj)
		})
	}
}

func TestMode2_DeleteCollection(t *testing.T) {
	type testCase struct {
		setupLegacyFn  func(m *mock.Mock)
		setupStorageFn func(m *mock.Mock)
		name           string
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name: "should delete a collection from both the LegacyStorage and Storage",
				setupLegacyFn: func(m *mock.Mock) {
					m.On("DeleteCollection", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleList, nil)
				},
				setupStorageFn: func(m *mock.Mock) {
					m.On("DeleteCollection", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleList, nil)
				},
			},
			{
				name: "should return an error when deleting a collection from the Storage fails",
				setupLegacyFn: func(m *mock.Mock) {
					m.On("DeleteCollection", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleList, nil)
				},
				setupStorageFn: func(m *mock.Mock) {
					m.On("DeleteCollection", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, errors.New("error"))
				},
				wantErr: true,
			},
			{
				name: "should return an error when deleting a collection from the LegacyStorage fails",
				setupLegacyFn: func(m *mock.Mock) {
					m.On("DeleteCollection", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, errors.New("error"))
				},
				wantErr: true,
			},
		}

	name := "foo"

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l := (rest.Storage)(nil)
			s := (rest.Storage)(nil)

			ls := storageMock{&mock.Mock{}, l}
			us := storageMock{&mock.Mock{}, s}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(ls.Mock)
			}
			if tt.setupStorageFn != nil {
				tt.setupStorageFn(us.Mock)
			}

			dw, err := NewDualWriter(kind, rest.Mode2, ls, us)
			require.NoError(t, err)

			obj, err := dw.DeleteCollection(context.Background(), func(ctx context.Context, obj runtime.Object) error { return nil }, &metav1.DeleteOptions{TypeMeta: metav1.TypeMeta{Kind: name}}, &metainternalversion.ListOptions{})

			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.Equal(t, exampleList, obj)
		})
	}
}

func TestMode2_Update(t *testing.T) {
	type testCase struct {
		expectedObj    runtime.Object
		setupLegacyFn  func(m *mock.Mock, input string)
		setupStorageFn func(m *mock.Mock, input string)
		name           string
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name: "should succeed when updating an object in both the LegacyStorage and Storage is successful",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Update", mock.Anything, input, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Update", mock.Anything, input, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
				expectedObj: exampleObj,
			},
			{
				name: "should return an error when updating the LegacyStorage fails",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Update", mock.Anything, input, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, false, errors.New("error"))
				},
				wantErr: true,
			},
			{
				name: "should return an error when updating the Storage fails",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Update", mock.Anything, input, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Update", mock.Anything, input, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, false, errors.New("error"))
				},
				wantErr: true,
			},
		}

	name := "foo"

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l := (rest.Storage)(nil)
			s := (rest.Storage)(nil)

			ls := storageMock{&mock.Mock{}, l}
			us := storageMock{&mock.Mock{}, s}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(ls.Mock, name)
			}
			if tt.setupStorageFn != nil {
				tt.setupStorageFn(us.Mock, name)
			}

			dw, err := NewDualWriter(kind, rest.Mode2, ls, us)
			require.NoError(t, err)

			obj, _, err := dw.Update(context.Background(), name, updatedObjInfoObj{}, func(ctx context.Context, obj runtime.Object) error { return nil }, func(ctx context.Context, obj, old runtime.Object) error { return nil }, false, &metav1.UpdateOptions{})

			if tt.wantErr {
				require.Error(t, err)
				return
			}

			require.Equal(t, tt.expectedObj, obj)
			require.NotEqual(t, anotherObj, obj)
		})
	}
}
