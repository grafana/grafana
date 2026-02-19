package dualwrite

import (
	"context"
	"testing"

	"github.com/stretchr/testify/mock"
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
			l := (rest.Storage)(nil)
			s := (rest.Storage)(nil)

			ls := storageMock{&mock.Mock{}, l}
			us := storageMock{&mock.Mock{}, s}

			// Only unified storage should be called
			us.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObj, nil)

			dw, err := NewStaticStorage(kind, m.mode, ls, us)
			require.NoError(t, err)

			obj, err := dw.Create(context.Background(), exampleObj, createFn, &metav1.CreateOptions{DryRun: dryRunAll})
			require.NoError(t, err)
			require.Equal(t, exampleObj, obj)

			// Legacy storage should NOT have been called
			ls.AssertNotCalled(t, "Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
			// Unified storage should have been called
			us.AssertCalled(t, "Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
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
			l := (rest.Storage)(nil)
			s := (rest.Storage)(nil)

			ls := storageMock{&mock.Mock{}, l}
			us := storageMock{&mock.Mock{}, s}

			// Only unified storage should be called
			us.On("Delete", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObj, false, nil)

			dw, err := NewStaticStorage(kind, m.mode, ls, us)
			require.NoError(t, err)

			obj, _, err := dw.Delete(context.Background(), "foo", func(context.Context, runtime.Object) error { return nil }, &metav1.DeleteOptions{DryRun: dryRunAll})
			require.NoError(t, err)
			require.Equal(t, exampleObj, obj)

			// Legacy storage should NOT have been called
			ls.AssertNotCalled(t, "Delete", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
			// Unified storage should have been called
			us.AssertCalled(t, "Delete", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
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
			l := (rest.Storage)(nil)
			s := (rest.Storage)(nil)

			ls := storageMock{&mock.Mock{}, l}
			us := storageMock{&mock.Mock{}, s}

			// Only unified storage should be called
			us.On("Update", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObj, false, nil)

			dw, err := NewStaticStorage(kind, m.mode, ls, us)
			require.NoError(t, err)

			obj, _, err := dw.Update(context.Background(), "foo", updatedObjInfoObj{},
				func(ctx context.Context, obj runtime.Object) error { return nil },
				func(ctx context.Context, obj, old runtime.Object) error { return nil },
				false, &metav1.UpdateOptions{DryRun: dryRunAll})
			require.NoError(t, err)
			require.Equal(t, exampleObj, obj)

			// Legacy storage should NOT have been called
			ls.AssertNotCalled(t, "Update", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything)
			// Unified storage should have been called
			us.AssertCalled(t, "Update", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything)
		})
	}
}

func TestDryRun_Update_WrapsObjInfoForLegacyReadModes(t *testing.T) {
	t.Run("Mode1 should wrap objInfo and set forceAllowCreate=true", func(t *testing.T) {
		l := (rest.Storage)(nil)
		s := (rest.Storage)(nil)

		ls := storageMock{&mock.Mock{}, l}
		us := storageMock{&mock.Mock{}, s}

		us.On("Update", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObj, false, nil)

		dw, err := NewStaticStorage(kind, rest.Mode1, ls, us)
		require.NoError(t, err)

		_, _, err = dw.Update(context.Background(), "foo", updatedObjInfoObj{},
			func(ctx context.Context, obj runtime.Object) error { return nil },
			func(ctx context.Context, obj, old runtime.Object) error { return nil },
			false, &metav1.UpdateOptions{DryRun: dryRunAll})
		require.NoError(t, err)

		// Verify unified was called with wrappedUpdateInfo and forceAllowCreate=true
		require.Len(t, us.Calls, 1)
		call := us.Calls[0]
		_, isWrapped := call.Arguments[2].(*wrappedUpdateInfo)
		require.True(t, isWrapped, "Mode1 dry-run should wrap objInfo with wrappedUpdateInfo")
		forceCreate := call.Arguments[5].(bool)
		require.True(t, forceCreate, "Mode1 dry-run should set forceAllowCreate=true")
	})

	t.Run("Mode2 should wrap objInfo and set forceAllowCreate=true", func(t *testing.T) {
		l := (rest.Storage)(nil)
		s := (rest.Storage)(nil)

		ls := storageMock{&mock.Mock{}, l}
		us := storageMock{&mock.Mock{}, s}

		us.On("Update", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObj, false, nil)

		dw, err := NewStaticStorage(kind, rest.Mode2, ls, us)
		require.NoError(t, err)

		_, _, err = dw.Update(context.Background(), "foo", updatedObjInfoObj{},
			func(ctx context.Context, obj runtime.Object) error { return nil },
			func(ctx context.Context, obj, old runtime.Object) error { return nil },
			false, &metav1.UpdateOptions{DryRun: dryRunAll})
		require.NoError(t, err)

		// Verify unified was called with wrappedUpdateInfo and forceAllowCreate=true
		require.Len(t, us.Calls, 1)
		call := us.Calls[0]
		_, isWrapped := call.Arguments[2].(*wrappedUpdateInfo)
		require.True(t, isWrapped, "Mode2 dry-run should wrap objInfo with wrappedUpdateInfo")
		forceCreate := call.Arguments[5].(bool)
		require.True(t, forceCreate, "Mode2 dry-run should set forceAllowCreate=true")
	})

	t.Run("Mode3 should pass original objInfo unchanged", func(t *testing.T) {
		l := (rest.Storage)(nil)
		s := (rest.Storage)(nil)

		ls := storageMock{&mock.Mock{}, l}
		us := storageMock{&mock.Mock{}, s}

		us.On("Update", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObj, false, nil)

		dw, err := NewStaticStorage(kind, rest.Mode3, ls, us)
		require.NoError(t, err)

		originalInfo := updatedObjInfoObj{}
		_, _, err = dw.Update(context.Background(), "foo", originalInfo,
			func(ctx context.Context, obj runtime.Object) error { return nil },
			func(ctx context.Context, obj, old runtime.Object) error { return nil },
			false, &metav1.UpdateOptions{DryRun: dryRunAll})
		require.NoError(t, err)

		// Verify unified was called with original objInfo (not wrapped)
		require.Len(t, us.Calls, 1)
		call := us.Calls[0]
		_, isWrapped := call.Arguments[2].(*wrappedUpdateInfo)
		require.False(t, isWrapped, "Mode3 dry-run should NOT wrap objInfo")
		forceCreate := call.Arguments[5].(bool)
		require.False(t, forceCreate, "Mode3 dry-run should preserve original forceAllowCreate=false")
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
			l := (rest.Storage)(nil)
			s := (rest.Storage)(nil)

			ls := storageMock{&mock.Mock{}, l}
			us := storageMock{&mock.Mock{}, s}

			// Only unified storage should be called
			us.On("DeleteCollection", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleList, nil)

			dw, err := NewStaticStorage(kind, m.mode, ls, us)
			require.NoError(t, err)

			obj, err := dw.DeleteCollection(context.Background(),
				func(ctx context.Context, obj runtime.Object) error { return nil },
				&metav1.DeleteOptions{DryRun: dryRunAll},
				&metainternalversion.ListOptions{})
			require.NoError(t, err)
			require.Equal(t, exampleList, obj)

			// Legacy storage should NOT have been called
			ls.AssertNotCalled(t, "DeleteCollection", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
			// Unified storage should have been called
			us.AssertCalled(t, "DeleteCollection", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
		})
	}
}
