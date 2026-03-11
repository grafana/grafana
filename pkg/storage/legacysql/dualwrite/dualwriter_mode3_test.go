package dualwrite

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/pkg/apiserver/rest"
)

// Mode3 now maps to DualWrite (same as Mode1): best-effort writes to unified, reads from legacy.

func TestMode3_Create(t *testing.T) {
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
				name:  "should succeed when creating an object in both the LegacyStorage and Storage",
				input: exampleObj,
				setupLegacyFn: func(m *mock.Mock, input runtime.Object) {
					m.On("Create", mock.Anything, input, mock.Anything, mock.Anything).Return(exampleObj, nil).Once()
				},
				setupStorageFn: func(m *mock.Mock, _ runtime.Object) {
					// We don't use the input here, as the input is transformed before being passed to unified storage.
					m.On("Create", mock.Anything, exampleObjNoRV, mock.Anything, mock.Anything).Return(exampleObj, nil).Once()
				},
			},
			{
				name:  "should return an error when creating an object in the legacy store fails",
				input: failingObj,
				setupLegacyFn: func(m *mock.Mock, input runtime.Object) {
					m.On("Create", mock.Anything, input, mock.Anything, mock.Anything).Return(nil, errors.New("error")).Once()
				},
				wantErr: true,
			},
			{
				name:  "should not error when creating in unified store fails (best effort)",
				input: exampleObj,
				setupLegacyFn: func(m *mock.Mock, input runtime.Object) {
					m.On("Create", mock.Anything, input, mock.Anything, mock.Anything).Return(exampleObj, nil).Once()
				},
				setupStorageFn: func(m *mock.Mock, _ runtime.Object) {
					m.On("Create", mock.Anything, exampleObjNoRV, mock.Anything, mock.Anything).Return(nil, errors.New("error")).Once()
				},
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

			dw, err := NewStaticStorage(kind, rest.Mode3, ls, us)
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

func TestMode3_Get(t *testing.T) {
	type testCase struct {
		setupLegacyFn  func(m *mock.Mock, name string)
		setupStorageFn func(m *mock.Mock, name string)
		name           string
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name: "should succeed when getting an object from LegacyStorage",
				setupLegacyFn: func(m *mock.Mock, name string) {
					m.On("Get", mock.Anything, name, mock.Anything).Return(exampleObj, nil)
				},
				setupStorageFn: func(m *mock.Mock, name string) {
					m.On("Get", mock.Anything, name, mock.Anything).Return(exampleObj, nil)
				},
			},
			{
				name: "should not error when getting an object from unified store fails (best effort)",
				setupLegacyFn: func(m *mock.Mock, name string) {
					m.On("Get", mock.Anything, name, mock.Anything).Return(exampleObj, nil)
				},
				setupStorageFn: func(m *mock.Mock, name string) {
					m.On("Get", mock.Anything, name, mock.Anything).Return(nil, errors.New("error"))
				},
			},
			{
				name: "should error when getting an object from LegacyStorage fails",
				setupLegacyFn: func(m *mock.Mock, name string) {
					m.On("Get", mock.Anything, name, mock.Anything).Return(nil, errors.New("error"))
				},
				setupStorageFn: func(m *mock.Mock, name string) {
					m.On("Get", mock.Anything, name, mock.Anything).Return(exampleObj, nil)
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

			dw, err := NewStaticStorage(kind, rest.Mode3, ls, us)
			require.NoError(t, err)

			obj, err := dw.Get(context.Background(), name, &metav1.GetOptions{})

			if tt.wantErr {
				require.Error(t, err)
				return
			}

			require.Equal(t, obj, exampleObj)
			require.NotEqual(t, obj, anotherObj)
		})
	}
}

func TestMode3_List(t *testing.T) {
	type testCase struct {
		setupLegacyFn  func(m *mock.Mock)
		setupStorageFn func(m *mock.Mock)
		name           string
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name: "should return a list from LegacyStorage with best-effort unified list",
				setupLegacyFn: func(m *mock.Mock) {
					m.On("List", mock.Anything, mock.Anything).Return(exampleList, nil)
				},
				setupStorageFn: func(m *mock.Mock) {
					m.On("List", mock.Anything, mock.Anything).Return(anotherList, nil)
				},
			},
			{
				name: "should error when listing from LegacyStorage fails",
				setupLegacyFn: func(m *mock.Mock) {
					m.On("List", mock.Anything, mock.Anything).Return(nil, errors.New("error"))
				},
				wantErr: true,
			},
			{
				name: "should not error when listing from unified fails (best effort)",
				setupLegacyFn: func(m *mock.Mock) {
					m.On("List", mock.Anything, mock.Anything).Return(exampleList, nil)
				},
				setupStorageFn: func(m *mock.Mock) {
					m.On("List", mock.Anything, mock.Anything).Return(nil, errors.New("error"))
				},
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

			dw, err := NewStaticStorage(kind, rest.Mode3, ls, us)
			require.NoError(t, err)

			res, err := dw.List(context.Background(), &metainternalversion.ListOptions{})

			if tt.wantErr {
				require.Error(t, err)
				return
			}

			require.Equal(t, exampleList, res)
		})
	}
}

func TestMode3_Delete(t *testing.T) {
	type testCase struct {
		setupLegacyFn  func(m *mock.Mock, input string)
		setupStorageFn func(m *mock.Mock, input string)
		name           string
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name: "should succeed when deleting an object in both stores",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Delete", mock.Anything, input, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Delete", mock.Anything, input, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
			},
			{
				name: "should return an error when deleting from LegacyStorage fails",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Delete", mock.Anything, input, mock.Anything, mock.Anything).Return(nil, false, errors.New("error"))
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Delete", mock.Anything, input, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
				wantErr: true,
			},
			{
				name: "should not error when deleting from unified fails (best effort)",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Delete", mock.Anything, input, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Delete", mock.Anything, input, mock.Anything, mock.Anything).Return(nil, false, errors.New("error"))
				},
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

			dw, err := NewStaticStorage(kind, rest.Mode3, ls, us)
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

func TestMode3_DeleteCollection(t *testing.T) {
	type testCase struct {
		setupLegacyFn  func(m *mock.Mock)
		setupStorageFn func(m *mock.Mock)
		name           string
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name: "should succeed when deleting a collection in both stores",
				setupLegacyFn: func(m *mock.Mock) {
					m.On("DeleteCollection", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleList, nil)
				},
				setupStorageFn: func(m *mock.Mock) {
					m.On("DeleteCollection", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleList, nil)
				},
			},
			{
				name: "should not error when deleting a collection from Storage fails (best effort)",
				setupLegacyFn: func(m *mock.Mock) {
					m.On("DeleteCollection", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleList, nil)
				},
				setupStorageFn: func(m *mock.Mock) {
					m.On("DeleteCollection", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, errors.New("error"))
				},
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

			dw, err := NewStaticStorage(kind, rest.Mode3, ls, us)
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

func TestMode3_Update(t *testing.T) {
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
				name: "should succeed when updating an object in both stores",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Update", mock.Anything, input, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObj, false, nil).Once()
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Update", mock.Anything, input, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObj, false, nil).Once()
				},
				expectedObj: exampleObj,
			},
			{
				name: "should return an error when updating an object in the LegacyStorage fails",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Update", mock.Anything, input, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, false, errors.New("error")).Once()
				},
				wantErr: true,
			},
			{
				name: "should not error when updating unified fails (best effort)",
				setupLegacyFn: func(m *mock.Mock, input string) {
					m.On("Update", mock.Anything, input, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObj, false, nil).Once()
				},
				setupStorageFn: func(m *mock.Mock, input string) {
					m.On("Update", mock.Anything, input, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, false, errors.New("error")).Once()
				},
				expectedObj: exampleObj,
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

			dw, err := NewStaticStorage(kind, rest.Mode3, ls, us)
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
