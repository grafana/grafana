package dualwrite

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

var kind = schema.GroupResource{Group: "g", Resource: "r"}

func TestRuntime_Create(t *testing.T) {
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
				name:  "should return an error when creating an object in the unified store fails and delete from LegacyStorage",
				input: exampleObj,
				setupLegacyFn: func(m *mock.Mock, input runtime.Object) {
					m.On("Delete", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObj, true, nil).Once()
					m.On("Create", mock.Anything, input, mock.Anything, mock.Anything).Return(exampleObj, nil).Once()
				},
				setupStorageFn: func(m *mock.Mock, _ runtime.Object) {
					// We don't use the input here, as the input is transformed before being passed to unified storage.
					m.On("Create", mock.Anything, exampleObjNoRV, mock.Anything, mock.Anything).Return(nil, errors.New("error")).Once()
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

			m := ProvideService(featuremgmt.WithFeatures(featuremgmt.FlagManagedDualWriter), p, kvstore.NewFakeKVStore(), nil)
			dw, err := m.NewStorage(kind, ls, us)
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

func TestRuntime_Get(t *testing.T) {
	type testCase struct {
		setupLegacyFn  func(m *mock.Mock, name string)
		setupStorageFn func(m *mock.Mock, name string)
		name           string
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name: "should succeed when getting an object from both stores",
				setupLegacyFn: func(m *mock.Mock, name string) {
					m.On("Get", mock.Anything, name, mock.Anything).Return(exampleObj, nil)
				},
				setupStorageFn: func(m *mock.Mock, name string) {
					m.On("Get", mock.Anything, name, mock.Anything).Return(exampleObj, nil)
				},
			},
			{
				name: "should return an error when getting an object in the unified store fails",
				setupLegacyFn: func(m *mock.Mock, name string) {
					m.On("Get", mock.Anything, name, mock.Anything).Return(exampleObj, nil)
				},
				setupStorageFn: func(m *mock.Mock, name string) {
					m.On("Get", mock.Anything, name, mock.Anything).Return(nil, errors.New("error"))
				},
				wantErr: true,
			},
			{
				name: "should succeed when getting an object in the LegacyStorage fails",
				setupLegacyFn: func(m *mock.Mock, name string) {
					m.On("Get", mock.Anything, name, mock.Anything).Return(nil, errors.New("error"))
				},
				setupStorageFn: func(m *mock.Mock, name string) {
					m.On("Get", mock.Anything, name, mock.Anything).Return(exampleObj, nil)
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

			m := ProvideService(featuremgmt.WithFeatures(featuremgmt.FlagManagedDualWriter), p, kvstore.NewFakeKVStore(), nil)
			dw, err := m.NewStorage(kind, ls, us)
			require.NoError(t, err)
			status, err := m.Status(context.Background(), kind)
			require.NoError(t, err)
			status.Migrated = now.UnixMilli()
			status.ReadUnified = true // Read from unified (like mode3)
			_, err = m.Update(context.Background(), status)
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

func TestRuntime_CreateWhileMigrating(t *testing.T) {
	type testCase struct {
		input          runtime.Object
		setupLegacyFn  func(m *mock.Mock, input runtime.Object)
		setupStorageFn func(m *mock.Mock, input runtime.Object)
		prepare        func(dual Service) (StorageStatus, error)
		name           string
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name:  "should succeed when not migrated",
				input: exampleObj,
				setupLegacyFn: func(m *mock.Mock, input runtime.Object) {
					m.On("Create", mock.Anything, input, mock.Anything, mock.Anything).Return(exampleObj, nil).Once()
				},
				setupStorageFn: func(m *mock.Mock, _ runtime.Object) {
					// We don't use the input here, as the input is transformed before being passed to unified storage.
					m.On("Create", mock.Anything, exampleObjNoRV, mock.Anything, mock.Anything).Return(exampleObj, nil).Once()
				},
				prepare: func(dual Service) (StorageStatus, error) {
					status, err := dual.Status(context.Background(), kind)
					require.NoError(t, err)
					status.Migrating = 0
					status.Migrated = 0
					return dual.Update(context.Background(), status)
				},
			},
			{
				name:    "should be unavailable if migrating",
				input:   failingObj,
				wantErr: true,
				prepare: func(dual Service) (StorageStatus, error) {
					status, err := dual.Status(context.Background(), kind)
					require.NoError(t, err)
					return dual.StartMigration(context.Background(), kind, status.UpdateKey)
				},
			},
			{
				name:  "should succeed after migration",
				input: exampleObj,
				setupLegacyFn: func(m *mock.Mock, input runtime.Object) {
					m.On("Create", mock.Anything, input, mock.Anything, mock.Anything).Return(exampleObj, nil).Once()
				},
				setupStorageFn: func(m *mock.Mock, _ runtime.Object) {
					// We don't use the input here, as the input is transformed before being passed to unified storage.
					m.On("Create", mock.Anything, exampleObjNoRV, mock.Anything, mock.Anything).Return(exampleObj, nil).Once()
				},
				prepare: func(dual Service) (StorageStatus, error) {
					status, err := dual.Status(context.Background(), kind)
					require.NoError(t, err)
					status.Migrating = 0
					status.Migrated = now.UnixMilli()
					status.ReadUnified = true
					return dual.Update(context.Background(), status)
				},
			},
		}

	// Shared provider across all tests
	dual := ProvideService(featuremgmt.WithFeatures(featuremgmt.FlagManagedDualWriter), p, kvstore.NewFakeKVStore(), nil)

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

			dw, err := dual.NewStorage(kind, ls, us)
			require.NoError(t, err)

			// Apply the changes and
			if tt.prepare != nil {
				_, err = tt.prepare(dual)
				require.NoError(t, err)
			}

			obj, err := dw.Create(context.Background(), tt.input, createFn, &metav1.CreateOptions{})

			if tt.wantErr {
				require.Error(t, err)
				return
			}

			require.Equal(t, exampleObj, obj)
		})
	}
}
