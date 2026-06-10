package annotation

import (
	"context"
	"errors"
	"fmt"
	"testing"

	authtypes "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"
	registryrest "k8s.io/apiserver/pkg/registry/rest"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// errStore returns a configurable error from every method. Used to verify the
// k8s adapter's translation of sentinel errors into apierrors.
type errStore struct {
	err error
}

func (s *errStore) Get(_ context.Context, _, _ string) (*annotationV0.Annotation, error) {
	return nil, s.err
}
func (s *errStore) List(_ context.Context, _ string, _ ListOptions) (*AnnotationList, error) {
	return nil, s.err
}
func (s *errStore) Create(_ context.Context, _ *annotationV0.Annotation) (*annotationV0.Annotation, error) {
	return nil, s.err
}
func (s *errStore) Update(_ context.Context, _ *annotationV0.Annotation) (*annotationV0.Annotation, error) {
	return nil, s.err
}
func (s *errStore) Delete(_ context.Context, _, _ string) error { return s.err }
func (s *errStore) Close() error                                { return nil }

// TestToAPIError covers the helper in isolation: each sentinel maps to the
// matching apierror predicate, wrapped sentinels still classify, already-typed
// apierrors pass through, and unknown errors stay raw so apiserver wraps as 500.
func TestToAPIError(t *testing.T) {
	t.Run("nil passes through", func(t *testing.T) {
		require.NoError(t, toAPIError(nil, "x"))
	})

	t.Run("bare sentinels map to apierrors", func(t *testing.T) {
		cases := []struct {
			name  string
			err   error
			check func(error) bool
		}{
			{"NotFound", ErrNotFound, apierrors.IsNotFound},
			{"AlreadyExists", ErrAlreadyExists, apierrors.IsAlreadyExists},
			{"InvalidInput", ErrInvalidInput, apierrors.IsBadRequest},
		}
		for _, tc := range cases {
			t.Run(tc.name, func(t *testing.T) {
				assert.True(t, tc.check(toAPIError(tc.err, "obj")))
			})
		}
	})

	t.Run("wrapped sentinels still classify", func(t *testing.T) {
		err := fmt.Errorf("%w: ns/obj", ErrAlreadyExists)
		assert.True(t, apierrors.IsAlreadyExists(toAPIError(err, "obj")))
	})

	t.Run("already an apierror passes through unchanged", func(t *testing.T) {
		in := apierrors.NewForbidden(annotationGR, "obj", errors.New("denied"))
		out := toAPIError(in, "obj")
		assert.Same(t, in, out)
	})

	t.Run("unknown error stays raw", func(t *testing.T) {
		raw := errors.New("boom")
		out := toAPIError(raw, "obj")
		assert.Same(t, raw, out)
		assert.False(t, apierrors.IsNotFound(out))
		assert.False(t, apierrors.IsAlreadyExists(out))
		assert.False(t, apierrors.IsBadRequest(out))
	})
}

// TestK8sAdapter_StoreErrorMapping verifies the full chain: store returns a
// sentinel → adapter returns the correct apierror. This is the test that
// pins the contract between Store implementations and the K8s boundary.
func TestK8sAdapter_StoreErrorMapping(t *testing.T) {
	ns := "org-1"
	allowAll := &fakeAccessClient{fn: func(_ authtypes.BatchCheckItem) bool { return true }}

	cases := []struct {
		name      string
		storeErr  error
		predicate func(error) bool
	}{
		{"not found", ErrNotFound, apierrors.IsNotFound},
		{"already exists", fmt.Errorf("%w: ns/obj", ErrAlreadyExists), apierrors.IsAlreadyExists},
		{"invalid input", fmt.Errorf("%w: bad time", ErrInvalidInput), apierrors.IsBadRequest},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			adapter := newTestAdapter(&errStore{err: tc.storeErr}, allowAll)
			ctx := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 1), ns)

			t.Run("Get", func(t *testing.T) {
				_, err := adapter.Get(ctx, "obj", &metav1.GetOptions{})
				assert.True(t, tc.predicate(err), "got %v", err)
			})

			t.Run("Create", func(t *testing.T) {
				obj := &annotationV0.Annotation{ObjectMeta: metav1.ObjectMeta{Name: "obj", Namespace: ns}}
				_, err := adapter.Create(ctx, obj, nil, &metav1.CreateOptions{})
				assert.True(t, tc.predicate(err), "got %v", err)
			})

			t.Run("Delete", func(t *testing.T) {
				_, _, err := adapter.Delete(ctx, "obj", nil, &metav1.DeleteOptions{})
				assert.True(t, tc.predicate(err), "got %v", err)
			})
		})
	}
}

// updatedObjectInfo is a minimal rest.UpdatedObjectInfo for tests that just
// returns the provided object unchanged.
type updatedObjectInfo struct{ obj *annotationV0.Annotation }

func (u *updatedObjectInfo) Preconditions() *metav1.Preconditions { return nil }
func (u *updatedObjectInfo) UpdatedObject(_ context.Context, _ runtime.Object) (runtime.Object, error) {
	return u.obj, nil
}

// TestK8sAdapter_Update_StoreErrors covers Update separately because its store
// error can come from either the pre-fetch Get or the Update call itself.
func TestK8sAdapter_Update_StoreErrors(t *testing.T) {
	ns := "org-1"
	allowAll := &fakeAccessClient{fn: func(_ authtypes.BatchCheckItem) bool { return true }}
	obj := &annotationV0.Annotation{ObjectMeta: metav1.ObjectMeta{Name: "obj", Namespace: ns}}

	t.Run("pre-fetch returns NotFound", func(t *testing.T) {
		adapter := newTestAdapter(&errStore{err: ErrNotFound}, allowAll)
		ctx := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 1), ns)
		_, _, err := adapter.Update(ctx, "obj", &updatedObjectInfo{obj: obj}, nil, nil, false, &metav1.UpdateOptions{})
		assert.True(t, apierrors.IsNotFound(err), "got %v", err)
	})
}

// TestMemoryStore_DuplicateCreate is the end-to-end smoke test: a backend that
// emits ErrAlreadyExists must surface as a 409 at the K8s boundary. Catches
// regressions where backends drift back to plain fmt.Errorf.
func TestMemoryStore_DuplicateCreate(t *testing.T) {
	ns := "org-1"
	allowAll := &fakeAccessClient{fn: func(_ authtypes.BatchCheckItem) bool { return true }}
	adapter := newTestAdapter(NewMemoryStore(), allowAll)
	ctx := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 1), ns)

	obj := &annotationV0.Annotation{ObjectMeta: metav1.ObjectMeta{Name: "obj", Namespace: ns}}
	_, err := adapter.Create(ctx, obj, nil, &metav1.CreateOptions{})
	require.NoError(t, err)

	_, err = adapter.Create(ctx, obj, nil, &metav1.CreateOptions{})
	require.Error(t, err)
	assert.True(t, apierrors.IsAlreadyExists(err), "expected 409 AlreadyExists, got %v", err)
}

// compile-time assertion that errStore implements Store
var _ Store = (*errStore)(nil)

// compile-time assertion that updatedObjectInfo implements rest.UpdatedObjectInfo
var _ registryrest.UpdatedObjectInfo = (*updatedObjectInfo)(nil)
