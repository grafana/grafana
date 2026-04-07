package dualwrite

import (
	"context"
	"errors"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	unifiedmigrations "github.com/grafana/grafana/pkg/storage/unified/migrations/contract"
)

var kind = schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}

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

			m, err := ProvideService(NewFakeConfig(), NewFakeMigrator(), NewFakeMigrationStatusReader(), prometheus.NewRegistry())
			require.NoError(t, err)
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

func TestDualWriter_RuntimeModeSwitch(t *testing.T) {
	// Verifies the core runtime-mode-switching guarantee: a *dualWriter created
	// in DualWrite mode automatically switches to Unified read routing on the
	// very next request after the status reader reports StorageModeUnified,
	// without being re-created.
	gr := schema.GroupResource{Group: "test.grafana.app", Resource: "widgets"}

	reader := &mutableStatusReader{mode: unifiedmigrations.StorageModeDualWrite}
	svc, err := ProvideService(NewFakeConfig(), NewFakeMigrator(), reader, prometheus.NewRegistry())
	require.NoError(t, err)

	ls := storageMock{&mock.Mock{}, (rest.Storage)(nil)}
	us := storageMock{&mock.Mock{}, (rest.Storage)(nil)}

	dw, err := svc.NewStorage(gr, ls, us)
	require.NoError(t, err)
	_, isDual := dw.(*dualWriter)
	require.True(t, isDual, "DualWrite mode must produce a *dualWriter")

	// DualWrite phase: Get returns the legacy result.
	// Background unified.Get may also fire; allow it with no call-count restriction.
	ls.On("Get", mock.Anything, "foo", mock.Anything).Return(exampleObj, nil).Once()
	us.On("Get", mock.Anything, "foo", mock.Anything).Return(anotherObj, nil)

	obj, err := dw.Get(context.Background(), "foo", &metav1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, exampleObj, obj, "DualWrite: result must come from legacy")

	// Flip to Unified without re-creating dw.
	reader.setMode(unifiedmigrations.StorageModeUnified)

	// Unified phase: Get returns the unified result.
	// legacy.Get must NOT be called — the mock panics on any unexpected call,
	// so this is an implicit assertion.
	obj, err = dw.Get(context.Background(), "foo", &metav1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, anotherObj, obj, "Unified: result must come from unified")

	ls.AssertExpectations(t)
}

func TestDualWriter_UnifiedModeSkipsLegacyMutations(t *testing.T) {
	// Verifies that once StorageModeUnified is active, Create/Update/Delete/DeleteCollection
	// bypass legacy storage entirely. The storageMock panics on any unexpected call, so
	// any legacy invocation here would fail the test implicitly.
	gr := schema.GroupResource{Group: "test.grafana.app", Resource: "widgets"}

	reader := &mutableStatusReader{mode: unifiedmigrations.StorageModeDualWrite}
	svc, err := ProvideService(NewFakeConfig(), NewFakeMigrator(), reader, prometheus.NewRegistry())
	require.NoError(t, err)

	ls := storageMock{&mock.Mock{}, (rest.Storage)(nil)}
	us := storageMock{&mock.Mock{}, (rest.Storage)(nil)}

	dw, err := svc.NewStorage(gr, ls, us)
	require.NoError(t, err)
	_, isDual := dw.(*dualWriter)
	require.True(t, isDual, "DualWrite mode must produce a *dualWriter")

	// Flip to Unified — legacy must not be touched for any mutation.
	reader.setMode(unifiedmigrations.StorageModeUnified)

	t.Run("Create routes only to unified", func(t *testing.T) {
		us.On("Create", mock.Anything, exampleObj, mock.Anything, mock.Anything).Return(exampleObj, nil).Once()
		obj, err := dw.Create(context.Background(), exampleObj, createFn, &metav1.CreateOptions{})
		require.NoError(t, err)
		require.Equal(t, exampleObj, obj)
		us.AssertExpectations(t)
	})

	t.Run("Delete routes only to unified", func(t *testing.T) {
		us.On("Delete", mock.Anything, "foo", mock.Anything, mock.Anything).Return(exampleObj, false, nil).Once()
		obj, _, err := dw.Delete(context.Background(), "foo", nil, &metav1.DeleteOptions{})
		require.NoError(t, err)
		require.Equal(t, exampleObj, obj)
		us.AssertExpectations(t)
	})

	t.Run("Update routes only to unified", func(t *testing.T) {
		us.On("Update", mock.Anything, "foo", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObj, false, nil).Once()
		obj, _, err := dw.Update(context.Background(), "foo", updatedObjInfoObj{}, createFn, nil, false, &metav1.UpdateOptions{})
		require.NoError(t, err)
		require.Equal(t, exampleObj, obj)
		us.AssertExpectations(t)
	})

	ls.AssertExpectations(t)
}

func TestRuntime_Get(t *testing.T) {
	t.Skip("skip until we use this for a non dashboard/folder resource")

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

			m, err := ProvideService(NewFakeConfig(), NewFakeMigrator(), NewFakeMigrationStatusReader(), prometheus.NewRegistry())
			require.NoError(t, err)
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
	t.Skip("skip until we use this for a non dashboard/folder resource")

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
	dual, err := ProvideService(NewFakeConfig(), NewFakeMigrator(), NewFakeMigrationStatusReader(), prometheus.NewRegistry())
	require.NoError(t, err)

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
