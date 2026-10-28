package annotation

import (
	"context"
	"fmt"
	"regexp"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
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

	t.Run("List", func(t *testing.T) {
		t.Run("Filters by dashboard UID", func(t *testing.T) {
			create(t, "list-dash", func(a *annotationV0.Annotation) { a.Spec.DashboardUID = &dashboardUID })

			list, err := store.List(ctx, ns, ListOptions{DashboardUID: dashboardUID})
			require.NoError(t, err)
			assert.Contains(t, annotationNames(list), "list-dash")
		})

		t.Run("Filters by panel ID", func(t *testing.T) {
			panelID := int64(42)
			create(t, "panel-match", func(a *annotationV0.Annotation) { a.Spec.PanelID = &panelID })
			create(t, "panel-other", func(a *annotationV0.Annotation) { other := int64(43); a.Spec.PanelID = &other })

			list, err := store.List(ctx, ns, ListOptions{PanelID: panelID})
			require.NoError(t, err)
			names := annotationNames(list)
			assert.Contains(t, names, "panel-match")
			assert.NotContains(t, names, "panel-other")
		})

		t.Run("Filters by time window", func(t *testing.T) {
			twDash := "tw-dash"
			from, to := int64(1000), int64(2000)
			timeEnd := func(v int64) func(*annotationV0.Annotation) {
				return func(a *annotationV0.Annotation) { a.Spec.TimeEnd = &v }
			}
			at := func(v int64) func(*annotationV0.Annotation) {
				return func(a *annotationV0.Annotation) {
					a.Spec.Time = v
					a.Spec.DashboardUID = &twDash
				}
			}

			create(t, "tw-point-before", at(500))
			create(t, "tw-point-inside", at(1500))
			create(t, "tw-point-after", at(2500))
			create(t, "tw-region-overlap-start", at(500), timeEnd(1500))
			create(t, "tw-region-overlap-end", at(1500), timeEnd(2500))
			create(t, "tw-region-before", at(100), timeEnd(500))
			create(t, "tw-region-after", at(2500), timeEnd(3000))

			list, err := store.List(ctx, ns, ListOptions{DashboardUID: twDash, From: from, To: to})
			require.NoError(t, err)

			names := annotationNames(list)
			assert.Contains(t, names, "tw-point-inside")
			assert.Contains(t, names, "tw-region-overlap-start")
			assert.Contains(t, names, "tw-region-overlap-end")
			assert.NotContains(t, names, "tw-point-before")
			assert.NotContains(t, names, "tw-point-after")
			assert.NotContains(t, names, "tw-region-before")
			assert.NotContains(t, names, "tw-region-after")
		})

		t.Run("Filters by tags requiring all to match", func(t *testing.T) {
			tags := func(vs ...string) func(*annotationV0.Annotation) {
				return func(a *annotationV0.Annotation) { a.Spec.Tags = vs }
			}
			create(t, "tags-all-both", tags("red", "blue"))
			create(t, "tags-all-one", tags("red"))

			list, err := store.List(ctx, ns, ListOptions{Tags: []string{"red", "blue"}})
			require.NoError(t, err)
			names := annotationNames(list)
			assert.Contains(t, names, "tags-all-both")
			assert.NotContains(t, names, "tags-all-one")
		})

		t.Run("Filters by tags matching any", func(t *testing.T) {
			tags := func(vs ...string) func(*annotationV0.Annotation) {
				return func(a *annotationV0.Annotation) { a.Spec.Tags = vs }
			}
			create(t, "tags-any-match", tags("green"))
			create(t, "tags-any-miss", tags("yellow"))

			list, err := store.List(ctx, ns, ListOptions{Tags: []string{"green", "orange"}, TagsMatchAny: true})
			require.NoError(t, err)
			names := annotationNames(list)
			assert.Contains(t, names, "tags-any-match")
			assert.NotContains(t, names, "tags-any-miss")
		})

		t.Run("Paginates with a continue token", func(t *testing.T) {
			pageDash := "page-dash"
			for _, name := range []string{"page-a", "page-b", "page-c"} {
				create(t, name, func(a *annotationV0.Annotation) { a.Spec.DashboardUID = &pageDash })
			}

			first, err := store.List(ctx, ns, ListOptions{DashboardUID: pageDash, Limit: 2})
			require.NoError(t, err)
			require.Len(t, first.Items, 2)
			require.NotEmpty(t, first.Continue, "expected a continue token when more results remain")

			second, err := store.List(ctx, ns, ListOptions{DashboardUID: pageDash, Limit: 2, Continue: first.Continue})
			require.NoError(t, err)
			require.Len(t, second.Items, 1)
			assert.Empty(t, second.Continue, "expected no continue token on the final page")

			all := append(annotationNames(first), annotationNames(second)...)
			assert.ElementsMatch(t, []string{"page-a", "page-b", "page-c"}, all)
		})

		t.Run("Orders a limited list by end time across points and tied ranges", func(t *testing.T) {
			ordDash := "ord-dash"
			at := func(start int64, end ...int64) func(*annotationV0.Annotation) {
				return func(a *annotationV0.Annotation) {
					a.Spec.Time = start
					a.Spec.DashboardUID = &ordDash
					if len(end) > 0 {
						a.Spec.TimeEnd = &end[0]
					}
				}
			}
			create(t, "a-point-hi", at(1000))
			create(t, "win-800", at(800, 900))
			create(t, "win-500", at(500, 900))
			create(t, "drop-300", at(300, 900))
			create(t, "drop-100", at(100, 900))
			create(t, "drop-50", at(50, 900))
			create(t, "b-point-lo", at(400))

			list, err := store.List(ctx, ns, ListOptions{DashboardUID: ordDash, Limit: 3})
			require.NoError(t, err)

			assert.Equal(t, []string{"a-point-hi", "win-800", "win-500"}, annotationNames(list))
		})
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

		t.Run("List includes soft-deleted with a tombstone when DeletedInclude", func(t *testing.T) {
			create(t, "sd-incl")
			require.NoError(t, store.Delete(ctx, ns, "sd-incl"))

			list, err := store.List(ctx, ns, ListOptions{Deleted: DeletedInclude})
			require.NoError(t, err)

			found := findByName(list, "sd-incl")
			require.NotNil(t, found, "expected soft-deleted annotation in DeletedInclude list")
			require.NotNil(t, found.DeletionTimestamp, "expected tombstone deletionTimestamp")
			assert.False(t, found.DeletionTimestamp.IsZero())
		})

		t.Run("List returns only tombstones when DeletedOnly", func(t *testing.T) {
			create(t, "sd-only-live")
			create(t, "sd-only-dead")
			require.NoError(t, store.Delete(ctx, ns, "sd-only-dead"))

			list, err := store.List(ctx, ns, ListOptions{Deleted: DeletedOnly})
			require.NoError(t, err)

			names := annotationNames(list)
			assert.Contains(t, names, "sd-only-dead")
			assert.NotContains(t, names, "sd-only-live")

			found := findByName(list, "sd-only-dead")
			require.NotNil(t, found)
			require.NotNil(t, found.DeletionTimestamp, "expected tombstone deletionTimestamp")
		})
	})
}

func TestIntegrationPostgresCleanup(t *testing.T) {
	ns := metav1.NamespaceDefault

	seed := func(t *testing.T, store *PostgreSQLStore, ctx context.Context, name string, ts time.Time) {
		t.Helper()
		_, err := store.Create(ctx, &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: ns},
			Spec:       annotationV0.AnnotationSpec{Text: name, Time: ts.UnixMilli()},
		})
		require.NoError(t, err, "create %s", name)
	}

	t.Run("drops partitions past the retention cutoff", func(t *testing.T) {
		store := newTestPostgresStore(t)
		ctx := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 1), ns)

		now := time.Date(2026, 1, 15, 12, 0, 0, 0, time.UTC)
		old := now.AddDate(0, 0, -120)   // past a 90-day cutoff: dropped
		recent := now.AddDate(0, 0, -30) // within the cutoff: kept
		seed(t, store, ctx, "old", old)
		seed(t, store, ctx, "recent", recent)

		// past the cutoff but ending within the retention window
		_, err := store.Create(ctx, &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{Name: "spanning", Namespace: ns},
			Spec:       annotationV0.AnnotationSpec{Text: "spanning", Time: old.UnixMilli(), TimeEnd: new(recent.UnixMilli())},
		})
		require.NoError(t, err)

		deleted, err := store.Cleanup(ctx, now.AddDate(0, 0, -90))
		require.NoError(t, err)
		assert.Equal(t, int64(1), deleted, "only the old partition's row should be counted")
		_, err = store.Get(ctx, ns, "spanning")
		assert.NoError(t, err, "a range ending within the cutoff should be kept")

		remaining := partitionNameSet(ctx, t, store)
		assert.NotContains(t, remaining, getPartitionName(old.UnixMilli()), "old partition should be dropped")
		assert.Contains(t, remaining, getPartitionName(recent.UnixMilli()), "recent partition should be kept")
	})

	t.Run("keeps recent partitions protected by the 24h floor even when past the cutoff", func(t *testing.T) {
		store := newTestPostgresStore(t)
		ctx := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 1), ns)

		now := time.Now().UTC()
		current := now                // this week: past a 1h cutoff, but inside the 24h floor
		old := now.AddDate(0, 0, -21) // several weeks back: past both the cutoff and the floor
		seed(t, store, ctx, "current", current)
		seed(t, store, ctx, "old", old)

		deleted, err := store.Cleanup(ctx, now.Add(-time.Hour))
		require.NoError(t, err)
		assert.Equal(t, int64(1), deleted, "only the old partition's row should be counted")

		remaining := partitionNameSet(ctx, t, store)
		assert.Contains(t, remaining, getPartitionName(current.UnixMilli()), "current partition should be kept by the 24h floor")
		assert.NotContains(t, remaining, getPartitionName(old.UnixMilli()), "old partition should be dropped")
	})
}

func TestIntegrationPostgresListPartitionPruning(t *testing.T) {
	store := newTestPostgresStore(t)
	ns := metav1.NamespaceDefault
	ctx := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 1), ns)

	now := time.Date(2026, 9, 23, 12, 0, 0, 0, time.UTC)
	from := now.AddDate(0, 0, -7)
	seed := func(name string, start, end time.Time) {
		t.Helper()
		_, err := store.Create(ctx, &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: ns},
			Spec:       annotationV0.AnnotationSpec{Text: name, Time: start.UnixMilli(), TimeEnd: new(end.UnixMilli())},
		})
		require.NoError(t, err)
	}

	for weeks := 4; weeks <= 20; weeks++ {
		at := now.AddDate(0, 0, -7*weeks)
		seed(fmt.Sprintf("old-%d", weeks), at, at)
	}
	// Starts before the window but overlaps it, so it lives in a recent partition.
	seed("long-range", now.AddDate(0, 0, -60), now.Add(-time.Hour))
	require.Equal(t, getPartitionName(now.Add(-time.Hour).UnixMilli()), partitionOf(t, store.pool, ns, "long-range"))
	seed("recent", now, now)

	opts := ListOptions{From: from.UnixMilli(), To: now.Add(time.Hour).UnixMilli()}

	list, err := store.List(ctx, ns, opts)
	require.NoError(t, err)
	assert.ElementsMatch(t, []string{"recent", "long-range"}, annotationNames(list))

	query, args := buildListQuery(ns, opts, 0, 100)
	rows, err := store.pool.Query(ctx, "EXPLAIN "+query, args...)
	require.NoError(t, err)
	scanned := map[string]struct{}{}
	for rows.Next() {
		var line string
		require.NoError(t, rows.Scan(&line))
		if m := scannedPartition.FindStringSubmatch(line); m != nil {
			scanned[m[1]] = struct{}{}
		}
	}
	require.NoError(t, rows.Err())

	assert.Equal(t, map[string]struct{}{getPartitionName(now.UnixMilli()): {}}, scanned,
		"partitions that ended before the window must be pruned")
}

var scannedPartition = regexp.MustCompile(` on (annotations_\d+w\d+) `)

func partitionOf(t *testing.T, pool *pgxpool.Pool, ns, name string) string {
	t.Helper()
	var partition string
	require.NoError(t, pool.QueryRow(t.Context(),
		`SELECT tableoid::regclass::text FROM annotations WHERE namespace = $1 AND name = $2`, ns, name).Scan(&partition))
	return partition
}

func partitionNameSet(ctx context.Context, t *testing.T, store *PostgreSQLStore) map[string]struct{} {
	t.Helper()
	partitions, err := listPartitions(ctx, store.pool)
	require.NoError(t, err)
	set := make(map[string]struct{}, len(partitions))
	for _, p := range partitions {
		set[p.Name] = struct{}{}
	}
	return set
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
