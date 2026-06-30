package annotation

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/bwmarrin/snowflake"
	authtypes "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
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

// updatedObjectInfo is a minimal rest.UpdatedObjectInfo for tests that just
// returns the provided object unchanged.
type updatedObjectInfo struct{ obj *annotationV0.Annotation }

func (u *updatedObjectInfo) Preconditions() *metav1.Preconditions { return nil }
func (u *updatedObjectInfo) UpdatedObject(_ context.Context, _ runtime.Object) (runtime.Object, error) {
	return u.obj, nil
}

func newTestAdapterWithLegacyID(store Store, ac authtypes.AccessClient) *k8sRESTAdapter {
	adapter := newTestAdapter(store, ac)
	node, err := snowflake.NewNode(0)
	if err != nil {
		panic(err)
	}
	adapter.snowflakeNode = node
	return adapter
}

// testGetLegacyID is a test helper that extracts the legacy ID from an annotation.
func testGetLegacyID(t *testing.T, anno *annotationV0.Annotation) int64 {
	t.Helper()
	return GetLegacyID(anno)
}

// testGetLegacyData is a test helper that extracts the legacy data blob from an annotation.
func testGetLegacyData(t *testing.T, anno *annotationV0.Annotation) string {
	t.Helper()
	v, _ := getLegacyData(anno)
	return v
}

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

func TestK8sAdapter_Create(t *testing.T) {
	ns := "org-1"
	allowAll := &fakeAccessClient{fn: func(_ authtypes.BatchCheckItem) bool { return true }}

	t.Run("duplicate returns 409", func(t *testing.T) {
		adapter := newTestAdapter(NewMemoryStore(), allowAll)
		ctx := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 1), ns)

		obj := &annotationV0.Annotation{ObjectMeta: metav1.ObjectMeta{Name: "obj", Namespace: ns}}
		_, err := adapter.Create(ctx, obj, nil, &metav1.CreateOptions{})
		require.NoError(t, err)

		_, err = adapter.Create(ctx, obj, nil, &metav1.CreateOptions{})
		require.Error(t, err)
		assert.True(t, apierrors.IsAlreadyExists(err), "expected 409 AlreadyExists, got %v", err)
	})

	t.Run("generates legacy ID when enabled", func(t *testing.T) {
		adapter := newTestAdapterWithLegacyID(NewMemoryStore(), allowAll)
		ctx := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 1), ns)

		obj := &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{Name: "test-anno", Namespace: ns},
			Spec:       annotationV0.AnnotationSpec{Text: "hello", Time: 1000},
		}
		result, err := adapter.Create(ctx, obj, nil, &metav1.CreateOptions{})
		require.NoError(t, err)

		id := testGetLegacyID(t, result.(*annotationV0.Annotation))
		assert.Greater(t, id, int64(0))
		assert.LessOrEqual(t, id, int64(maxSafeJSInt))
	})

	t.Run("preserves caller-supplied legacy ID", func(t *testing.T) {
		adapter := newTestAdapterWithLegacyID(NewMemoryStore(), allowAll)
		ctx := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 1), ns)

		obj := &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "backfilled",
				Namespace: ns,
				Labels:    map[string]string{LabelKeyLegacyID: "12345"},
			},
			Spec: annotationV0.AnnotationSpec{Text: "backfilled", Time: 1000},
		}
		result, err := adapter.Create(ctx, obj, nil, &metav1.CreateOptions{})
		require.NoError(t, err)

		assert.Equal(t, int64(12345), testGetLegacyID(t, result.(*annotationV0.Annotation)))
	})

	t.Run("no legacy ID when disabled", func(t *testing.T) {
		adapter := newTestAdapter(NewMemoryStore(), allowAll)
		ctx := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 1), ns)

		obj := &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{Name: "no-id", Namespace: ns},
			Spec:       annotationV0.AnnotationSpec{Text: "hello", Time: 1000},
		}
		result, err := adapter.Create(ctx, obj, nil, &metav1.CreateOptions{})
		require.NoError(t, err)

		assert.Equal(t, int64(0), testGetLegacyID(t, result.(*annotationV0.Annotation)))
	})

	t.Run("generates unique IDs", func(t *testing.T) {
		adapter := newTestAdapterWithLegacyID(NewMemoryStore(), allowAll)
		ctx := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 1), ns)

		seen := make(map[int64]struct{}, 50)
		for i := range 50 {
			obj := &annotationV0.Annotation{
				ObjectMeta: metav1.ObjectMeta{Name: fmt.Sprintf("anno-%d", i), Namespace: ns},
				Spec:       annotationV0.AnnotationSpec{Text: "hello", Time: int64(1000 + i)},
			}
			result, err := adapter.Create(ctx, obj, nil, &metav1.CreateOptions{})
			require.NoError(t, err)

			id := testGetLegacyID(t, result.(*annotationV0.Annotation))
			_, dup := seen[id]
			assert.False(t, dup, "duplicate ID: %d", id)
			seen[id] = struct{}{}
		}
	})

	t.Run("preserves caller-supplied legacy data", func(t *testing.T) {
		adapter := newTestAdapterWithLegacyID(NewMemoryStore(), allowAll)
		ctx := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 1), ns)

		obj := &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{
				Name:        "with-data",
				Namespace:   ns,
				Annotations: map[string]string{AnnotationKeyLegacyData: `{"foo":"bar"}`},
			},
			Spec: annotationV0.AnnotationSpec{Text: "hello", Time: 1000},
		}
		result, err := adapter.Create(ctx, obj, nil, &metav1.CreateOptions{})
		require.NoError(t, err)

		assert.Equal(t, `{"foo":"bar"}`, testGetLegacyData(t, result.(*annotationV0.Annotation)))
	})

	t.Run("no legacy data when none supplied", func(t *testing.T) {
		adapter := newTestAdapterWithLegacyID(NewMemoryStore(), allowAll)
		ctx := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 1), ns)

		obj := &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{Name: "no-data", Namespace: ns},
			Spec:       annotationV0.AnnotationSpec{Text: "hello", Time: 1000},
		}
		result, err := adapter.Create(ctx, obj, nil, &metav1.CreateOptions{})
		require.NoError(t, err)

		assert.Empty(t, testGetLegacyData(t, result.(*annotationV0.Annotation)))
	})
}

func TestK8sAdapter_Get(t *testing.T) {
	ns := "org-1"
	allowAll := &fakeAccessClient{fn: func(_ authtypes.BatchCheckItem) bool { return true }}

	t.Run("returns the stored legacy data", func(t *testing.T) {
		adapter := newTestAdapterWithLegacyID(NewMemoryStore(), allowAll)
		ctx := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 1), ns)

		obj := &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{
				Name:        "with-data",
				Namespace:   ns,
				Annotations: map[string]string{AnnotationKeyLegacyData: `{"foo":"bar"}`},
			},
			Spec: annotationV0.AnnotationSpec{Text: "hello", Time: 1000},
		}
		_, err := adapter.Create(ctx, obj, nil, &metav1.CreateOptions{})
		require.NoError(t, err)

		got, err := adapter.Get(ctx, "with-data", &metav1.GetOptions{})
		require.NoError(t, err)
		assert.Equal(t, `{"foo":"bar"}`, testGetLegacyData(t, got.(*annotationV0.Annotation)))
	})
}

// TestK8sAdapter_Update_StoreErrors covers Update separately because its store
// error can come from either the pre-fetch Get or the Update call itself.
func TestK8sAdapter_Update(t *testing.T) {
	ns := "org-1"
	allowAll := &fakeAccessClient{fn: func(_ authtypes.BatchCheckItem) bool { return true }}

	seedWithData := func(t *testing.T) (*k8sRESTAdapter, context.Context) {
		t.Helper()
		adapter := newTestAdapterWithLegacyID(NewMemoryStore(), allowAll)
		ctx := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 1), ns)
		_, err := adapter.Create(ctx, &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{
				Name:        "anno",
				Namespace:   ns,
				Annotations: map[string]string{AnnotationKeyLegacyData: `{"foo":"bar"}`},
			},
			Spec: annotationV0.AnnotationSpec{Text: "hello", Time: 1000},
		}, nil, &metav1.CreateOptions{})
		require.NoError(t, err)
		return adapter, ctx
	}

	t.Run("pre-fetch returns NotFound", func(t *testing.T) {
		adapter := newTestAdapter(&errStore{err: ErrNotFound}, allowAll)
		ctx := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 1), ns)
		obj := &annotationV0.Annotation{ObjectMeta: metav1.ObjectMeta{Name: "obj", Namespace: ns}}
		_, _, err := adapter.Update(ctx, "obj", &updatedObjectInfo{obj: obj}, nil, nil, false, &metav1.UpdateOptions{})
		assert.True(t, apierrors.IsNotFound(err), "got %v", err)
	})

	t.Run("preserves legacy data when the update omits it", func(t *testing.T) {
		adapter, ctx := seedWithData(t)

		// Incoming object has no legacy data annotation — the omitted case.
		incoming := &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{Name: "anno", Namespace: ns},
			Spec:       annotationV0.AnnotationSpec{Text: "updated", Time: 1000},
		}
		updated, _, err := adapter.Update(ctx, "anno", &updatedObjectInfo{obj: incoming}, nil, nil, false, &metav1.UpdateOptions{})
		require.NoError(t, err)
		assert.Equal(t, `{"foo":"bar"}`, testGetLegacyData(t, updated.(*annotationV0.Annotation)))

		got, err := adapter.Get(ctx, "anno", &metav1.GetOptions{})
		require.NoError(t, err)
		assert.Equal(t, `{"foo":"bar"}`, testGetLegacyData(t, got.(*annotationV0.Annotation)))
	})

	t.Run("clears legacy data when the update supplies an empty value", func(t *testing.T) {
		adapter, ctx := seedWithData(t)

		// Present-but-empty annotation signals an explicit clear.
		incoming := &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{
				Name:        "anno",
				Namespace:   ns,
				Annotations: map[string]string{AnnotationKeyLegacyData: ""},
			},
			Spec: annotationV0.AnnotationSpec{Text: "updated", Time: 1000},
		}
		_, _, err := adapter.Update(ctx, "anno", &updatedObjectInfo{obj: incoming}, nil, nil, false, &metav1.UpdateOptions{})
		require.NoError(t, err)

		got, err := adapter.Get(ctx, "anno", &metav1.GetOptions{})
		require.NoError(t, err)
		assert.Empty(t, testGetLegacyData(t, got.(*annotationV0.Annotation)))
	})

	t.Run("overwrites legacy data when the update supplies a new value", func(t *testing.T) {
		adapter, ctx := seedWithData(t)

		incoming := &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{
				Name:        "anno",
				Namespace:   ns,
				Annotations: map[string]string{AnnotationKeyLegacyData: `{"baz":"qux"}`},
			},
			Spec: annotationV0.AnnotationSpec{Text: "updated", Time: 1000},
		}
		_, _, err := adapter.Update(ctx, "anno", &updatedObjectInfo{obj: incoming}, nil, nil, false, &metav1.UpdateOptions{})
		require.NoError(t, err)

		got, err := adapter.Get(ctx, "anno", &metav1.GetOptions{})
		require.NoError(t, err)
		assert.Equal(t, `{"baz":"qux"}`, testGetLegacyData(t, got.(*annotationV0.Annotation)))
	})
}

func TestK8sAdapter_List(t *testing.T) {
	ns := "org-1"
	allowAll := &fakeAccessClient{fn: func(_ authtypes.BatchCheckItem) bool { return true }}

	setup := func(t *testing.T) (*k8sRESTAdapter, context.Context) {
		t.Helper()
		adapter := newTestAdapterWithLegacyID(NewMemoryStore(), allowAll)
		ctx := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 1), ns)

		for _, tc := range []struct {
			name string
			id   string
		}{
			{"anno-a", "100"},
			{"anno-b", "200"},
		} {
			obj := &annotationV0.Annotation{
				ObjectMeta: metav1.ObjectMeta{
					Name:      tc.name,
					Namespace: ns,
					Labels:    map[string]string{LabelKeyLegacyID: tc.id},
				},
				Spec: annotationV0.AnnotationSpec{Text: tc.name, Time: 1000},
			}
			_, err := adapter.Create(ctx, obj, nil, &metav1.CreateOptions{})
			require.NoError(t, err)
		}
		return adapter, ctx
	}

	t.Run("field selector filters by legacy ID", func(t *testing.T) {
		adapter, ctx := setup(t)
		result, err := adapter.List(ctx, &internalversion.ListOptions{
			FieldSelector: fields.ParseSelectorOrDie("metadata.legacyID=100"),
		})
		require.NoError(t, err)
		list := result.(*annotationV0.AnnotationList)
		require.Len(t, list.Items, 1)
		assert.Equal(t, "anno-a", list.Items[0].Name)
	})

	t.Run("non-matching legacy ID returns empty", func(t *testing.T) {
		adapter, ctx := setup(t)
		result, err := adapter.List(ctx, &internalversion.ListOptions{
			FieldSelector: fields.ParseSelectorOrDie("metadata.legacyID=999"),
		})
		require.NoError(t, err)
		list := result.(*annotationV0.AnnotationList)
		assert.Empty(t, list.Items)
	})

	t.Run("no field selector returns all", func(t *testing.T) {
		adapter, ctx := setup(t)
		result, err := adapter.List(ctx, &internalversion.ListOptions{})
		require.NoError(t, err)
		list := result.(*annotationV0.AnnotationList)
		assert.Len(t, list.Items, 2)
	})
}

// TestK8sAdapter_MaxScopeCount pins the contract for Spec.Scopes cardinality
// on both Create and Update:
// - len(Scopes) <= maxScopeCount succeeds;
// - over the limit returns 400 BadRequest and the annotation is not persisted/mutated.
// maxScopeCount = 0 is the configured "no scopes allowed" mode.
func TestK8sAdapter_MaxScopeCount(t *testing.T) {
	ns := "org-1"
	allowAll := &fakeAccessClient{fn: func(_ authtypes.BatchCheckItem) bool { return true }}

	buildScopes := func(n int) []string {
		s := make([]string, n)
		for i := range n {
			s[i] = fmt.Sprintf("scope-%d", i)
		}
		return s
	}

	cases := []struct {
		name          string
		maxScopeCount int
		scopeCount    int
		expectErr     bool
	}{
		{"at limit succeeds", 3, 3, false},
		{"over limit rejected", 3, 4, true},
		{"zero allows no scopes", 0, 0, false},
		{"zero rejects any scopes", 0, 1, true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			store := NewMemoryStore()
			adapter := newTestAdapter(store, allowAll)
			adapter.maxScopeCount = tc.maxScopeCount
			ctx := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 1), ns)

			name := "anno"
			obj := &annotationV0.Annotation{
				ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: ns},
				Spec:       annotationV0.AnnotationSpec{Text: "hello", Time: 1000, Scopes: buildScopes(tc.scopeCount)},
			}
			_, err := adapter.Create(ctx, obj, nil, &metav1.CreateOptions{})

			if !tc.expectErr {
				require.NoError(t, err)
				return
			}

			require.Error(t, err)
			assert.True(t, apierrors.IsBadRequest(err), "expected 400 BadRequest, got %v", err)
			assert.Contains(t, err.Error(), "max allowed")

			_, getErr := store.Get(ctx, ns, name)
			assert.ErrorIs(t, getErr, ErrNotFound, "annotation should not have been persisted")
		})
	}

	t.Run("update over limit rejected", func(t *testing.T) {
		store := NewMemoryStore()
		adapter := newTestAdapter(store, allowAll)
		adapter.maxScopeCount = 2
		ctx := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 1), ns)

		name := "original"
		orig := &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: ns},
			Spec:       annotationV0.AnnotationSpec{Text: "hello", Time: 1000, Scopes: buildScopes(1)},
		}
		_, err := adapter.Create(ctx, orig, nil, &metav1.CreateOptions{})
		require.NoError(t, err)

		updated := &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: ns},
			Spec:       annotationV0.AnnotationSpec{Text: "hello", Time: 1000, Scopes: buildScopes(3)},
		}
		_, _, err = adapter.Update(ctx, name, &updatedObjectInfo{obj: updated}, nil, nil, false, &metav1.UpdateOptions{})
		require.Error(t, err)
		assert.True(t, apierrors.IsBadRequest(err), "expected 400 BadRequest, got %v", err)
		assert.Contains(t, err.Error(), "max allowed")

		stored, getErr := store.Get(ctx, ns, name)
		require.NoError(t, getErr, "original annotation must still exist")
		assert.Len(t, stored.Spec.Scopes, 1, "stored annotation must not have been mutated")
	})
}

// TestK8sAdapter_ValidateAnnotation pins the time-bounds validation applied on annotation.time for the Create function.
func TestK8sAdapter_ValidateAnnotation(t *testing.T) {
	ns := "org-1"
	allowAll := &fakeAccessClient{fn: func(_ authtypes.BatchCheckItem) bool { return true }}

	const retentionTTL = 90 * 24 * time.Hour
	now := time.Now().UTC().UnixMilli()
	second := time.Second.Milliseconds()
	futureWindowMs := maxFutureWindow.Milliseconds()
	retentionMs := retentionTTL.Milliseconds()

	timeEnd := func(ms int64) *int64 { return &ms }

	cases := []struct {
		name        string
		time        int64
		timeEnd     *int64
		expectErr   bool
		errContains string
	}{
		{"time is current", now, nil, false, ""},
		{"recent past within retention", now - retentionMs/2, nil, false, ""},
		{"inside future bound", now + futureWindowMs - second, nil, false, ""},
		{"too far in the future", now + futureWindowMs + second, nil, true, "time cannot be more than 1 week in the future"},
		{"older than retention TTL", now - retentionMs - second, nil, true, "time cannot be older than retention TTL"},
		{"valid timeEnd after time", now, timeEnd(now + second), false, ""},
		{"timeEnd before time", now, timeEnd(now - second), true, "timeEnd must be after time"},
		{"timeEnd too far in the future", now, timeEnd(now + futureWindowMs + second), true, "timeEnd cannot be more than 1 week in the future"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			store := NewMemoryStore()
			adapter := newTestAdapter(store, allowAll)
			adapter.retentionTTL = retentionTTL
			ctx := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 1), ns)

			name := "anno"
			obj := &annotationV0.Annotation{
				ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: ns},
				Spec:       annotationV0.AnnotationSpec{Text: "test", Time: tc.time, TimeEnd: tc.timeEnd},
			}
			_, err := adapter.Create(ctx, obj, nil, &metav1.CreateOptions{})

			if !tc.expectErr {
				require.NoError(t, err)
				return
			}

			require.Error(t, err)
			assert.True(t, apierrors.IsBadRequest(err), "expected 400 BadRequest, got %v", err)
			assert.Contains(t, err.Error(), tc.errContains)

			_, getErr := store.Get(ctx, ns, name)
			assert.ErrorIs(t, getErr, ErrNotFound, "invalid annotation should not have been persisted")
		})
	}
}

// compile-time assertion that errStore implements Store
var _ Store = (*errStore)(nil)

// compile-time assertion that updatedObjectInfo implements rest.UpdatedObjectInfo
var _ registryrest.UpdatedObjectInfo = (*updatedObjectInfo)(nil)
