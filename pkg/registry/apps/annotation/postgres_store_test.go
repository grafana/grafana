package annotation

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/util/testutil/pgtest"
)

// newTestPostgresStore returns a PostgreSQL-backed Store
func newTestPostgresStore(t *testing.T) *PostgreSQLStore {
	t.Helper()
	dsn := pgtest.NewDatabase(t)

	cfg := PostgreSQLStoreConfig{
		ConnectionString: dsn,
	}

	store, err := NewPostgreSQLStore(t.Context(), cfg, nil)
	require.NoError(t, err, "create postgres store")
	t.Cleanup(func() { _ = store.Close() })

	return store
}

func TestIntegrationPostgresStore(t *testing.T) {
	store := newTestPostgresStore(t)
	ns := metav1.NamespaceDefault
	ctx := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 1), ns)

	dashboardUID := "dash-1"
	create := func(t *testing.T, name string, mutate ...func(*annotationV0.Annotation)) *annotationV0.Annotation {
		t.Helper()
		anno := &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: ns},
			Spec:       annotationV0.AnnotationSpec{Text: "text", Time: 1000, Tags: []string{"tag1"}},
		}
		for _, m := range mutate {
			m(anno)
		}
		_, err := store.Create(ctx, anno)
		require.NoError(t, err)
		return anno
	}

	t.Run("Create then Get round-trips the annotation", func(t *testing.T) {
		create(t, "crud-get", func(a *annotationV0.Annotation) {
			a.Spec.Text = "hello"
			a.Spec.Tags = []string{"a", "b"}
			a.Spec.DashboardUID = &dashboardUID
		})

		got, err := store.Get(ctx, ns, "crud-get")
		require.NoError(t, err)
		assert.Equal(t, "hello", got.Spec.Text)
		assert.Equal(t, []string{"a", "b"}, got.Spec.Tags)
		require.NotNil(t, got.Spec.DashboardUID)
		assert.Equal(t, dashboardUID, *got.Spec.DashboardUID)
	})

	t.Run("Get of a missing annotation returns ErrNotFound", func(t *testing.T) {
		_, err := store.Get(ctx, ns, "does-not-exist")
		require.ErrorIs(t, err, ErrNotFound)
	})

	t.Run("Update mutates the stored annotation", func(t *testing.T) {
		create(t, "crud-update")

		_, err := store.Update(ctx, &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{Name: "crud-update", Namespace: ns},
			Spec:       annotationV0.AnnotationSpec{Text: "changed", Time: 1000, Tags: []string{"changed"}},
		})
		require.NoError(t, err)

		got, err := store.Get(ctx, ns, "crud-update")
		require.NoError(t, err)
		assert.Equal(t, "changed", got.Spec.Text)
		assert.Equal(t, []string{"changed"}, got.Spec.Tags)
	})

	t.Run("Update of a missing annotation returns ErrNotFound", func(t *testing.T) {
		_, err := store.Update(ctx, &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{Name: "missing", Namespace: ns},
			Spec:       annotationV0.AnnotationSpec{Text: "x", Time: 1000},
		})
		require.ErrorIs(t, err, ErrNotFound)
	})

	t.Run("List filters by dashboard UID", func(t *testing.T) {
		create(t, "list-dash", func(a *annotationV0.Annotation) { a.Spec.DashboardUID = &dashboardUID })

		list, err := store.List(ctx, ns, ListOptions{DashboardUID: dashboardUID})
		require.NoError(t, err)
		assert.Contains(t, annotationNames(list), "list-dash")
	})

	t.Run("Delete of a missing annotation returns ErrNotFound", func(t *testing.T) {
		err := store.Delete(ctx, ns, "does-not-exist")
		require.ErrorIs(t, err, ErrNotFound)
	})

	t.Run("soft delete", func(t *testing.T) {
		t.Run("Delete tombstones and Get returns the row with a deletionTimestamp", func(t *testing.T) {
			create(t, "sd-get")
			require.NoError(t, store.Delete(ctx, ns, "sd-get"))

			got, err := store.Get(ctx, ns, "sd-get")
			require.NoError(t, err)
			require.NotNil(t, got.DeletionTimestamp, "expected a tombstone deletionTimestamp")
			assert.False(t, got.DeletionTimestamp.IsZero())
		})

		t.Run("re-delete of a tombstoned annotation returns ErrNotFound", func(t *testing.T) {
			create(t, "sd-redelete")
			require.NoError(t, store.Delete(ctx, ns, "sd-redelete"))

			require.ErrorIs(t, store.Delete(ctx, ns, "sd-redelete"), ErrNotFound)
		})

		t.Run("Update of a soft-deleted annotation returns ErrNotFound", func(t *testing.T) {
			create(t, "sd-update")
			require.NoError(t, store.Delete(ctx, ns, "sd-update"))

			_, err := store.Update(ctx, &annotationV0.Annotation{
				ObjectMeta: metav1.ObjectMeta{Name: "sd-update", Namespace: ns},
				Spec:       annotationV0.AnnotationSpec{Text: "changed", Time: 1000},
			})
			require.ErrorIs(t, err, ErrNotFound)
		})

		t.Run("List excludes soft-deleted by default", func(t *testing.T) {
			create(t, "sd-live")
			create(t, "sd-dead")
			require.NoError(t, store.Delete(ctx, ns, "sd-dead"))

			list, err := store.List(ctx, ns, ListOptions{})
			require.NoError(t, err)
			names := annotationNames(list)
			assert.Contains(t, names, "sd-live")
			assert.NotContains(t, names, "sd-dead")
		})

		t.Run("List includes soft-deleted with a tombstone when IncludeDeleted", func(t *testing.T) {
			create(t, "sd-incl")
			require.NoError(t, store.Delete(ctx, ns, "sd-incl"))

			list, err := store.List(ctx, ns, ListOptions{IncludeDeleted: true})
			require.NoError(t, err)

			found := findByName(list, "sd-incl")
			require.NotNil(t, found, "expected soft-deleted annotation in IncludeDeleted list")
			require.NotNil(t, found.DeletionTimestamp, "expected tombstone deletionTimestamp")
			assert.False(t, found.DeletionTimestamp.IsZero())
		})
	})
}

func annotationNames(list *AnnotationList) []string {
	names := make([]string, 0, len(list.Items))
	for i := range list.Items {
		names = append(names, list.Items[i].Name)
	}
	return names
}

func findByName(list *AnnotationList, name string) *annotationV0.Annotation {
	for i := range list.Items {
		if list.Items[i].Name == name {
			return &list.Items[i]
		}
	}
	return nil
}
