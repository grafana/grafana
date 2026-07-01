// Package migration holds integration tests for the annotations migration proxy:
// the legacy /api/annotations HTTP API (xorm store) proxying to a standalone
// app-platform annotation API server (postgres store) across migration phases.
//
// The new API runs standalone via the enterprise apiserver (--skip-auth) on
// postgres; the legacy Grafana server runs in-process and proxies to it over
// real HTTP.
//
// The standalone apiserver can only be started once per process (its cobra
// command installs a k8s signal handler that panics on a second call), so a
// single top-level test owns it and runs every scenario as a subtest. Each
// subtest gets a fresh legacy Grafana server and a truncated new store.
//
// Run with:
//
//	make devenv sources=postgres_tests
//	GRAFANA_TEST_DB=postgres go test -count=1 -v \
//	    -run TestIntegrationAnnotationMigration ./pkg/tests/api/annotations/migration/
package migration

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationAnnotationMigration(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	// One standalone new API server, owned by this test, shared by all subtests.
	api := startNewAPI(t)

	t.Run("off phase reads and writes only the legacy store", func(t *testing.T) {
		h := newHarness(t, api, phaseOff)

		id := h.createAnnotation(t, annotationReq{Text: "off-phase", Tags: []string{"off"}})
		require.NotZero(t, id)

		got := h.getAnnotationByID(t, id)
		require.Equal(t, "off-phase", got.Text)

		require.Zero(t, h.newStore.countByLegacyID(t, id), "phase=off must not write to the new store")
		require.Equal(t, 1, h.legacyCount(t), "phase=off must write to the legacy store")
	})

	// Write-through: a create via the legacy API lands in the new postgres store
	// with a grafana.app/legacyID label, and the returned legacy int ID resolves
	// back through the legacy GET-by-id path (the label round-trip).
	t.Run("write-through", func(t *testing.T) {
		for _, phase := range []migrationPhase{phaseWrites, phaseAll} {
			t.Run(string(phase), func(t *testing.T) {
				h := newHarness(t, api, phase)

				id := h.createAnnotation(t, annotationReq{Text: "write-through", Tags: []string{"wt"}})
				require.NotZero(t, id)

				require.Equal(t, 1, h.newStore.countByLegacyID(t, id),
					"phase=%s must write through to the new store", phase)

				got := h.getAnnotationByID(t, id)
				require.Equal(t, "write-through", got.Text)
				require.Equal(t, id, got.ID)
			})
		}
	})

	// Read merge/dedup:
	//   - proxy-writes: a list merges new-store results with legacy results,
	//     deduped by legacy ID (new store wins).
	//   - proxy-all: user annotations come from the new store only; alert
	//     annotations (which never migrate) still surface from legacy.
	t.Run("read merge", func(t *testing.T) {
		t.Run("proxy-writes merges new and legacy, deduped by legacy ID", func(t *testing.T) {
			h := newHarness(t, api, phaseWrites)

			proxied := h.createAnnotation(t, annotationReq{Text: "proxied"})
			legacyOnly := h.seedLegacyOnly(t, &annotations.Item{Text: "legacy-only"})

			got := h.listAnnotations(t, "")
			ids := idSet(got)
			require.Contains(t, ids, proxied, "proxied annotation should appear")
			require.Contains(t, ids, legacyOnly, "legacy-only annotation should appear via merge")
			require.Len(t, got, len(ids), "merge must not duplicate annotations")
		})

		t.Run("proxy-all serves user annotations from new store and alerts from legacy", func(t *testing.T) {
			h := newHarness(t, api, phaseAll)

			userAnno := h.createAnnotation(t, annotationReq{Text: "user-anno"})
			// Alert annotations never migrate; they live only in legacy.
			alertAnno := h.seedLegacyOnly(t, &annotations.Item{Text: "alert-anno", AlertID: 42})

			all := h.listAnnotations(t, "")
			ids := idSet(all)
			require.Contains(t, ids, userAnno, "user annotation should come from the new store")
			require.Contains(t, ids, alertAnno, "alert annotation should still come from legacy")

			userOnly := h.listAnnotations(t, "type=annotation")
			require.Contains(t, idSet(userOnly), userAnno)
			require.NotContains(t, idSet(userOnly), alertAnno, "type=annotation must not include legacy alerts")
		})
	})

	// Update/delete of a record that only exists in legacy (not yet migrated) fall
	// back to the legacy store when the new store returns not-found.
	t.Run("update/delete fallback", func(t *testing.T) {
		for _, phase := range []migrationPhase{phaseWrites, phaseAll} {
			t.Run(string(phase), func(t *testing.T) {
				t.Run("update falls back to legacy", func(t *testing.T) {
					h := newHarness(t, api, phase)
					id := h.seedLegacyOnly(t, &annotations.Item{Text: "before"})

					h.updateAnnotationText(t, id, "after", nil)

					got := h.getAnnotationByID(t, id)
					require.Equal(t, "after", got.Text)
					require.Zero(t, h.newStore.countByLegacyID(t, id),
						"fallback update must not write the record to the new store")
				})

				t.Run("delete falls back to legacy", func(t *testing.T) {
					h := newHarness(t, api, phase)
					id := h.seedLegacyOnly(t, &annotations.Item{Text: "doomed"})

					h.deleteAnnotation(t, id)

					require.Equal(t, 0, h.legacyCount(t), "record should be gone from legacy")
				})
			})
		}
	})
}

// idSet collects the IDs of the given DTOs.
func idSet(items []*annotations.ItemDTO) map[int64]bool {
	set := make(map[int64]bool, len(items))
	for _, it := range items {
		set[it.ID] = true
	}
	return set
}
