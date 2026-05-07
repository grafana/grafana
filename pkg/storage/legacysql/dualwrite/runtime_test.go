package dualwrite

import (
	"context"
	"errors"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	unifiedmigrations "github.com/grafana/grafana/pkg/storage/unified/migrations/contract"
)

var kind = schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}

func TestRuntime_Create(t *testing.T) {
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

	ls := &fakeStorage{}
	us := &fakeStorage{}

	dw, err := svc.NewStorage(gr, ls, us)
	require.NoError(t, err)
	_, isDual := dw.(*dualWriter)
	require.True(t, isDual, "DualWrite mode must produce a *dualWriter")

	// DualWrite phase: Get returns the legacy result.
	// Background unified.Get may also fire.
	ls.onGet(exampleObj, nil)
	us.onGet(anotherObj, nil)

	obj, err := dw.Get(context.Background(), "foo", &metav1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, exampleObj, obj, "DualWrite: result must come from legacy")

	// Flip to Unified without re-creating dw.
	reader.setMode(unifiedmigrations.StorageModeUnified)

	// Unified phase: Get returns the unified result.
	obj, err = dw.Get(context.Background(), "foo", &metav1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, anotherObj, obj, "Unified: result must come from unified")
}

func TestDualWriter_UnifiedModeSkipsLegacyMutations(t *testing.T) {
	// Verifies that once StorageModeUnified is active, Create/Update/Delete/DeleteCollection
	// bypass legacy storage entirely. The fakeStorage returns zero values by default, so
	// any legacy invocation would return unexpected results and fail assertions.
	gr := schema.GroupResource{Group: "test.grafana.app", Resource: "widgets"}

	reader := &mutableStatusReader{mode: unifiedmigrations.StorageModeDualWrite}
	svc, err := ProvideService(NewFakeConfig(), NewFakeMigrator(), reader, prometheus.NewRegistry())
	require.NoError(t, err)

	ls := &fakeStorage{}
	us := &fakeStorage{}

	dw, err := svc.NewStorage(gr, ls, us)
	require.NoError(t, err)
	_, isDual := dw.(*dualWriter)
	require.True(t, isDual, "DualWrite mode must produce a *dualWriter")

	// Flip to Unified — legacy must not be touched for any mutation.
	reader.setMode(unifiedmigrations.StorageModeUnified)

	t.Run("Create routes only to unified", func(t *testing.T) {
		us.onCreate(exampleObj, nil)
		obj, err := dw.Create(context.Background(), exampleObj, createFn, &metav1.CreateOptions{})
		require.NoError(t, err)
		require.Equal(t, exampleObj, obj)
		require.Empty(t, ls.createCalls, "legacy Create should not have been called")
	})

	t.Run("Delete routes only to unified", func(t *testing.T) {
		us.onDelete(exampleObj, nil)
		obj, _, err := dw.Delete(context.Background(), "foo", nil, &metav1.DeleteOptions{})
		require.NoError(t, err)
		require.Equal(t, exampleObj, obj)
		require.Empty(t, ls.deleteCalls, "legacy Delete should not have been called")
	})

	t.Run("Update routes only to unified", func(t *testing.T) {
		us.onUpdate(exampleObj, nil)
		obj, _, err := dw.Update(context.Background(), "foo", updatedObjInfoObj{}, createFn, nil, false, &metav1.UpdateOptions{})
		require.NoError(t, err)
		require.Equal(t, exampleObj, obj)
		require.Empty(t, ls.updateCalls, "legacy Update should not have been called")
	})
}

func TestRuntime_Get(t *testing.T) {
	t.Skip("skip until we use this for a non dashboard/folder resource")

	type testCase struct {
		setupLegacyFn  func(s *fakeStorage)
		setupStorageFn func(s *fakeStorage)
		name           string
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name: "should succeed when getting an object from both stores",
				setupLegacyFn: func(s *fakeStorage) {
					s.onGet(exampleObj, nil)
				},
				setupStorageFn: func(s *fakeStorage) {
					s.onGet(exampleObj, nil)
				},
			},
			{
				name: "should return an error when getting an object in the unified store fails",
				setupLegacyFn: func(s *fakeStorage) {
					s.onGet(exampleObj, nil)
				},
				setupStorageFn: func(s *fakeStorage) {
					s.onGet(nil, errors.New("error"))
				},
				wantErr: true,
			},
			{
				name: "should succeed when getting an object in the LegacyStorage fails",
				setupLegacyFn: func(s *fakeStorage) {
					s.onGet(nil, errors.New("error"))
				},
				setupStorageFn: func(s *fakeStorage) {
					s.onGet(exampleObj, nil)
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
		setupLegacyFn  func(s *fakeStorage, input runtime.Object)
		setupStorageFn func(s *fakeStorage, input runtime.Object)
		prepare        func(dual Service) (StorageStatus, error)
		name           string
		wantErr        bool
	}
	tests :=
		[]testCase{
			{
				name:  "should succeed when not migrated",
				input: exampleObj,
				setupLegacyFn: func(s *fakeStorage, input runtime.Object) {
					s.onCreate(exampleObj, nil)
				},
				setupStorageFn: func(s *fakeStorage, _ runtime.Object) {
					s.onCreate(exampleObj, nil)
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
				setupLegacyFn: func(s *fakeStorage, input runtime.Object) {
					s.onCreate(exampleObj, nil)
				},
				setupStorageFn: func(s *fakeStorage, _ runtime.Object) {
					s.onCreate(exampleObj, nil)
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
			ls := &fakeStorage{}
			us := &fakeStorage{}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(ls, tt.input)
			}
			if tt.setupStorageFn != nil {
				tt.setupStorageFn(us, tt.input)
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
