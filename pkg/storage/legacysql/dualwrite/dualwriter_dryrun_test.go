package dualwrite

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/pkg/apiserver/rest"
)

// dryRunOptions contains the standard DryRun field value used in k8s dry-run requests.
var dryRunAll = []string{metav1.DryRunAll}

func TestDryRun_Create(t *testing.T) {
	modes := []struct {
		name string
		mode rest.DualWriterMode
	}{
		{"Mode1", rest.Mode1},
		{"Mode2", rest.Mode2},
		{"Mode3", rest.Mode3},
	}

	for _, m := range modes {
		t.Run(m.name+" should not create in legacy storage when dry-run is set", func(t *testing.T) {
			ls := &fakeStorage{}
			us := &fakeStorage{}

			// Only unified storage should be called
			us.onCreate(exampleObj, nil)

			dw, err := newStorage(kind, m.mode, ls, us)
			require.NoError(t, err)

			obj, err := dw.Create(context.Background(), exampleObj, createFn, &metav1.CreateOptions{DryRun: dryRunAll})
			require.NoError(t, err)
			require.Equal(t, exampleObj, obj)

			// Legacy storage should NOT have been called
			require.Empty(t, ls.createCalls)
			// Unified storage should have been called
			require.NotEmpty(t, us.createCalls)
		})
	}
}

func TestDryRun_Delete(t *testing.T) {
	modes := []struct {
		name string
		mode rest.DualWriterMode
	}{
		{"Mode1", rest.Mode1},
		{"Mode2", rest.Mode2},
		{"Mode3", rest.Mode3},
	}

	for _, m := range modes {
		t.Run(m.name+" should not delete in legacy storage when dry-run is set", func(t *testing.T) {
			ls := &fakeStorage{}
			us := &fakeStorage{}

			// Only unified storage should be called
			us.onDelete(exampleObj, nil)

			dw, err := newStorage(kind, m.mode, ls, us)
			require.NoError(t, err)

			obj, _, err := dw.Delete(context.Background(), "foo", func(context.Context, runtime.Object) error { return nil }, &metav1.DeleteOptions{DryRun: dryRunAll})
			require.NoError(t, err)
			require.Equal(t, exampleObj, obj)

			// Legacy storage should NOT have been called
			require.Empty(t, ls.deleteCalls)
			// Unified storage should have been called
			require.NotEmpty(t, us.deleteCalls)
		})
	}
}

func TestDryRun_Update(t *testing.T) {
	modes := []struct {
		name string
		mode rest.DualWriterMode
	}{
		{"Mode1", rest.Mode1},
		{"Mode2", rest.Mode2},
		{"Mode3", rest.Mode3},
	}

	for _, m := range modes {
		t.Run(m.name+" should not update in legacy storage when dry-run is set", func(t *testing.T) {
			ls := &fakeStorage{}
			us := &fakeStorage{}

			// Only unified storage should be called
			us.onUpdate(exampleObj, nil)

			dw, err := newStorage(kind, m.mode, ls, us)
			require.NoError(t, err)

			obj, _, err := dw.Update(context.Background(), "foo", updatedObjInfoObj{},
				func(ctx context.Context, obj runtime.Object) error { return nil },
				func(ctx context.Context, obj, old runtime.Object) error { return nil },
				false, &metav1.UpdateOptions{DryRun: dryRunAll})
			require.NoError(t, err)
			require.Equal(t, exampleObj, obj)

			// Legacy storage should NOT have been called
			require.Empty(t, ls.updateCalls)
			// Unified storage should have been called
			require.NotEmpty(t, us.updateCalls)
		})
	}
}

func TestDryRun_Update_WrapsObjInfoForLegacyReadModes(t *testing.T) {
	t.Run("Mode1 should wrap objInfo and set forceAllowCreate=true", func(t *testing.T) {
		ls := &fakeStorage{}
		us := &fakeStorage{}

		us.onUpdate(exampleObj, nil)

		dw, err := newStorage(kind, rest.Mode1, ls, us)
		require.NoError(t, err)

		_, _, err = dw.Update(context.Background(), "foo", updatedObjInfoObj{},
			func(ctx context.Context, obj runtime.Object) error { return nil },
			func(ctx context.Context, obj, old runtime.Object) error { return nil },
			false, &metav1.UpdateOptions{DryRun: dryRunAll})
		require.NoError(t, err)

		// Verify unified was called with wrappedUpdateInfo and forceAllowCreate=true
		require.Len(t, us.updateCalls, 1)
		call := us.updateCalls[0]
		_, isWrapped := call.args[2].(*wrappedUpdateInfo)
		require.True(t, isWrapped, "Mode1 dry-run should wrap objInfo with wrappedUpdateInfo")
		forceCreate := call.args[5].(bool)
		require.True(t, forceCreate, "Mode1 dry-run should set forceAllowCreate=true")
	})

	t.Run("Mode2 should wrap objInfo and set forceAllowCreate=true", func(t *testing.T) {
		ls := &fakeStorage{}
		us := &fakeStorage{}

		us.onUpdate(exampleObj, nil)

		dw, err := newStorage(kind, rest.Mode2, ls, us)
		require.NoError(t, err)

		_, _, err = dw.Update(context.Background(), "foo", updatedObjInfoObj{},
			func(ctx context.Context, obj runtime.Object) error { return nil },
			func(ctx context.Context, obj, old runtime.Object) error { return nil },
			false, &metav1.UpdateOptions{DryRun: dryRunAll})
		require.NoError(t, err)

		// Verify unified was called with wrappedUpdateInfo and forceAllowCreate=true
		require.Len(t, us.updateCalls, 1)
		call := us.updateCalls[0]
		_, isWrapped := call.args[2].(*wrappedUpdateInfo)
		require.True(t, isWrapped, "Mode2 dry-run should wrap objInfo with wrappedUpdateInfo")
		forceCreate := call.args[5].(bool)
		require.True(t, forceCreate, "Mode2 dry-run should set forceAllowCreate=true")
	})

	t.Run("Mode3 should wrap objInfo and set forceAllowCreate=true (same as Mode1)", func(t *testing.T) {
		ls := &fakeStorage{}
		us := &fakeStorage{}

		us.onUpdate(exampleObj, nil)

		dw, err := newStorage(kind, rest.Mode3, ls, us)
		require.NoError(t, err)

		_, _, err = dw.Update(context.Background(), "foo", updatedObjInfoObj{},
			func(ctx context.Context, obj runtime.Object) error { return nil },
			func(ctx context.Context, obj, old runtime.Object) error { return nil },
			false, &metav1.UpdateOptions{DryRun: dryRunAll})
		require.NoError(t, err)

		// Mode3 now maps to DualWrite (same as Mode1), so objInfo should be wrapped
		require.Len(t, us.updateCalls, 1)
		call := us.updateCalls[0]
		_, isWrapped := call.args[2].(*wrappedUpdateInfo)
		require.True(t, isWrapped, "Mode3 dry-run should wrap objInfo with wrappedUpdateInfo")
		forceCreate := call.args[5].(bool)
		require.True(t, forceCreate, "Mode3 dry-run should set forceAllowCreate=true")
	})
}

func TestDryRun_DeleteCollection(t *testing.T) {
	modes := []struct {
		name string
		mode rest.DualWriterMode
	}{
		{"Mode1", rest.Mode1},
		{"Mode2", rest.Mode2},
		{"Mode3", rest.Mode3},
	}

	for _, m := range modes {
		t.Run(m.name+" should not delete collection in legacy storage when dry-run is set", func(t *testing.T) {
			ls := &fakeStorage{}
			us := &fakeStorage{}

			// Only unified storage should be called
			us.onDeleteCollection(exampleList, nil)

			dw, err := newStorage(kind, m.mode, ls, us)
			require.NoError(t, err)

			obj, err := dw.DeleteCollection(context.Background(),
				func(ctx context.Context, obj runtime.Object) error { return nil },
				&metav1.DeleteOptions{DryRun: dryRunAll},
				&metainternalversion.ListOptions{})
			require.NoError(t, err)
			require.Equal(t, exampleList, obj)

			// Legacy storage should NOT have been called
			require.Empty(t, ls.deleteCollectionCalls)
			// Unified storage should have been called
			require.NotEmpty(t, us.deleteCollectionCalls)
		})
	}
}
