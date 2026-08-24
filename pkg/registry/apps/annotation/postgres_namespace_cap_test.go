package annotation

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func TestIntegrationPostgresNamespaceCap(t *testing.T) {
	seed := func(t *testing.T, store *PostgreSQLStore, ctx context.Context, namespace, name string, ts time.Time) {
		t.Helper()
		_, err := store.Create(ctx, &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: namespace},
			Spec:       annotationV0.AnnotationSpec{Text: name, Time: ts.UnixMilli()},
		})
		require.NoError(t, err, "create %s", name)
	}

	namespaceCount := func(t *testing.T, store *PostgreSQLStore, namespace string) int64 {
		t.Helper()
		var count int64
		err := store.pool.QueryRow(t.Context(), `SELECT count FROM annotation_namespace_counts WHERE namespace = $1`, namespace).Scan(&count)
		require.NoError(t, err)
		return count
	}

	t.Run("no-op when under the cap", func(t *testing.T) {
		store := newTestPostgresStore(t)
		ns := metav1.NamespaceDefault
		ctx := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 1), ns)

		now := time.Now().UTC()
		seed(t, store, ctx, ns, "a", now)
		seed(t, store, ctx, ns, "b", now)

		deleted, err := store.EnforceNamespaceCap(ctx, 5)
		require.NoError(t, err)
		assert.Equal(t, int64(0), deleted)
		assert.Equal(t, int64(2), namespaceCount(t, store, ns))
	})

	t.Run("prunes oldest annotations down to the cap and decrements the counter", func(t *testing.T) {
		store := newTestPostgresStore(t)
		ns := metav1.NamespaceDefault
		ctx := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 1), ns)

		now := time.Now().UTC()
		seed(t, store, ctx, ns, "oldest", now.Add(-3*time.Hour))
		seed(t, store, ctx, ns, "older", now.Add(-2*time.Hour))
		seed(t, store, ctx, ns, "newer", now.Add(-time.Hour))
		seed(t, store, ctx, ns, "newest", now)

		deleted, err := store.EnforceNamespaceCap(ctx, 2)
		require.NoError(t, err)
		assert.Equal(t, int64(2), deleted)
		assert.Equal(t, int64(2), namespaceCount(t, store, ns))

		list, err := store.List(ctx, ns, ListOptions{Deleted: DeletedInclude})
		require.NoError(t, err)
		names := annotationNames(list)
		assert.ElementsMatch(t, []string{"newer", "newest"}, names, "only the two newest annotations should remain")
	})

	t.Run("caps are enforced independently per namespace", func(t *testing.T) {
		store := newTestPostgresStore(t)
		nsA, nsB := "ns-a", "ns-b"
		ctxA := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 1), nsA)
		ctxB := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 1), nsB)

		now := time.Now().UTC()
		seed(t, store, ctxA, nsA, "a1", now.Add(-time.Hour))
		seed(t, store, ctxA, nsA, "a2", now)
		seed(t, store, ctxB, nsB, "b1", now)

		deleted, err := store.EnforceNamespaceCap(context.Background(), 1)
		require.NoError(t, err)
		assert.Equal(t, int64(1), deleted, "only ns-a is over the cap")
		assert.Equal(t, int64(1), namespaceCount(t, store, nsA))
		assert.Equal(t, int64(1), namespaceCount(t, store, nsB))
	})

	t.Run("a cap of zero disables enforcement", func(t *testing.T) {
		store := newTestPostgresStore(t)
		ns := metav1.NamespaceDefault
		ctx := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 1), ns)

		seed(t, store, ctx, ns, "a", time.Now().UTC())

		deleted, err := store.EnforceNamespaceCap(ctx, 0)
		require.NoError(t, err)
		assert.Equal(t, int64(0), deleted)
	})
}
