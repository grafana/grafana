package dualwrite

import (
	"context"
	"errors"
	"testing"

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
		setupLegacyFn  func(s *fakeStorage, input runtime.Object)
		setupStorageFn func(s *fakeStorage, input runtime.Object)
		name           string
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name:  "should succeed when creating an object in both the LegacyStorage and Storage",
				input: exampleObj,
				setupLegacyFn: func(s *fakeStorage, input runtime.Object) {
					s.onCreate(exampleObj, nil)
				},
				setupStorageFn: func(s *fakeStorage, _ runtime.Object) {
					s.onCreate(exampleObj, nil)
				},
			},
			{
				name:  "should return an error when creating an object in the legacy store fails",
				input: failingObj,
				setupLegacyFn: func(s *fakeStorage, input runtime.Object) {
					s.onCreate(nil, errors.New("error"))
				},
				wantErr: true,
			},
			{
				name:  "should not error when creating in unified store fails (best effort)",
				input: exampleObj,
				setupLegacyFn: func(s *fakeStorage, input runtime.Object) {
					s.onCreate(exampleObj, nil)
				},
				setupStorageFn: func(s *fakeStorage, _ runtime.Object) {
					s.onCreate(nil, errors.New("error"))
				},
			},
		}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ls := &fakeStorage{}
			us := &fakeStorage{}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(ls, tt.input)
			}
			if tt.setupStorageFn != nil {
				tt.setupStorageFn(us, tt.input)
			}

			dw, err := newStorage(kind, rest.Mode3, ls, us)
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
		setupLegacyFn  func(s *fakeStorage)
		setupStorageFn func(s *fakeStorage)
		name           string
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name: "should succeed when getting an object from LegacyStorage",
				setupLegacyFn: func(s *fakeStorage) {
					s.onGet(exampleObj, nil)
				},
				setupStorageFn: func(s *fakeStorage) {
					s.onGet(exampleObj, nil)
				},
			},
			{
				name: "should not error when getting an object from unified store fails (best effort)",
				setupLegacyFn: func(s *fakeStorage) {
					s.onGet(exampleObj, nil)
				},
				setupStorageFn: func(s *fakeStorage) {
					s.onGet(nil, errors.New("error"))
				},
			},
			{
				name: "should error when getting an object from LegacyStorage fails",
				setupLegacyFn: func(s *fakeStorage) {
					s.onGet(nil, errors.New("error"))
				},
				setupStorageFn: func(s *fakeStorage) {
					s.onGet(exampleObj, nil)
				},
				wantErr: true,
			},
		}

	name := "foo"

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ls := &fakeStorage{}
			us := &fakeStorage{}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(ls)
			}
			if tt.setupStorageFn != nil {
				tt.setupStorageFn(us)
			}

			dw, err := newStorage(kind, rest.Mode3, ls, us)
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
		setupLegacyFn  func(s *fakeStorage)
		setupStorageFn func(s *fakeStorage)
		name           string
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name: "should return a list from LegacyStorage with best-effort unified list",
				setupLegacyFn: func(s *fakeStorage) {
					s.onList(exampleList, nil)
				},
				setupStorageFn: func(s *fakeStorage) {
					s.onList(anotherList, nil)
				},
			},
			{
				name: "should error when listing from LegacyStorage fails",
				setupLegacyFn: func(s *fakeStorage) {
					s.onList(nil, errors.New("error"))
				},
				wantErr: true,
			},
			{
				name: "should not error when listing from unified fails (best effort)",
				setupLegacyFn: func(s *fakeStorage) {
					s.onList(exampleList, nil)
				},
				setupStorageFn: func(s *fakeStorage) {
					s.onList(nil, errors.New("error"))
				},
			},
		}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ls := &fakeStorage{}
			us := &fakeStorage{}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(ls)
			}
			if tt.setupStorageFn != nil {
				tt.setupStorageFn(us)
			}

			dw, err := newStorage(kind, rest.Mode3, ls, us)
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
		setupLegacyFn  func(s *fakeStorage)
		setupStorageFn func(s *fakeStorage)
		name           string
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name: "should succeed when deleting an object in both stores",
				setupLegacyFn: func(s *fakeStorage) {
					s.onDelete(exampleObj, nil)
				},
				setupStorageFn: func(s *fakeStorage) {
					s.onDelete(exampleObj, nil)
				},
			},
			{
				name: "should return an error when deleting from LegacyStorage fails",
				setupLegacyFn: func(s *fakeStorage) {
					s.onDelete(nil, errors.New("error"))
				},
				setupStorageFn: func(s *fakeStorage) {
					s.onDelete(exampleObj, nil)
				},
				wantErr: true,
			},
			{
				name: "should not error when deleting from unified fails (best effort)",
				setupLegacyFn: func(s *fakeStorage) {
					s.onDelete(exampleObj, nil)
				},
				setupStorageFn: func(s *fakeStorage) {
					s.onDelete(nil, errors.New("error"))
				},
			},
		}

	name := "foo"

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ls := &fakeStorage{}
			us := &fakeStorage{}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(ls)
			}
			if tt.setupStorageFn != nil {
				tt.setupStorageFn(us)
			}

			dw, err := newStorage(kind, rest.Mode3, ls, us)
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
		setupLegacyFn  func(s *fakeStorage)
		setupStorageFn func(s *fakeStorage)
		name           string
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name: "should succeed when deleting a collection in both stores",
				setupLegacyFn: func(s *fakeStorage) {
					s.onDeleteCollection(exampleList, nil)
				},
				setupStorageFn: func(s *fakeStorage) {
					s.onDeleteCollection(exampleList, nil)
				},
			},
			{
				name: "should not error when deleting a collection from Storage fails (best effort)",
				setupLegacyFn: func(s *fakeStorage) {
					s.onDeleteCollection(exampleList, nil)
				},
				setupStorageFn: func(s *fakeStorage) {
					s.onDeleteCollection(nil, errors.New("error"))
				},
			},
			{
				name: "should return an error when deleting a collection from the LegacyStorage fails",
				setupLegacyFn: func(s *fakeStorage) {
					s.onDeleteCollection(nil, errors.New("error"))
				},
				wantErr: true,
			},
		}

	name := "foo"

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ls := &fakeStorage{}
			us := &fakeStorage{}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(ls)
			}
			if tt.setupStorageFn != nil {
				tt.setupStorageFn(us)
			}

			dw, err := newStorage(kind, rest.Mode3, ls, us)
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
		setupLegacyFn  func(s *fakeStorage)
		setupStorageFn func(s *fakeStorage)
		name           string
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name: "should succeed when updating an object in both stores",
				setupLegacyFn: func(s *fakeStorage) {
					s.onUpdate(exampleObj, nil)
				},
				setupStorageFn: func(s *fakeStorage) {
					s.onUpdate(exampleObj, nil)
				},
				expectedObj: exampleObj,
			},
			{
				name: "should return an error when updating an object in the LegacyStorage fails",
				setupLegacyFn: func(s *fakeStorage) {
					s.onUpdate(nil, errors.New("error"))
				},
				wantErr: true,
			},
			{
				name: "should not error when updating unified fails (best effort)",
				setupLegacyFn: func(s *fakeStorage) {
					s.onUpdate(exampleObj, nil)
				},
				setupStorageFn: func(s *fakeStorage) {
					s.onUpdate(nil, errors.New("error"))
				},
				expectedObj: exampleObj,
			},
		}

	name := "foo"

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ls := &fakeStorage{}
			us := &fakeStorage{}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(ls)
			}
			if tt.setupStorageFn != nil {
				tt.setupStorageFn(us)
			}

			dw, err := newStorage(kind, rest.Mode3, ls, us)
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
