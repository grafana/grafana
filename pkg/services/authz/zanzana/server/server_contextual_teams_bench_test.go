// Contextual team membership benches: compare OpenFGA check cost when team#member
// is stored in the database vs. passed as contextual tuples (IdP groups), with optional
// chunking when many teams are present. Run: go test -run=^$ -bench=BenchmarkContextualTeam -benchmem ./pkg/services/authz/zanzana/server/
package server

import (
	"context"
	"fmt"
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	zStore "github.com/grafana/grafana/pkg/services/authz/zanzana/store"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

// contextualTeamBenchNS is a dedicated namespace for these lightweight benches.
const contextualTeamBenchNS = "ctx-team-bench"

// setupContextualTeamListLargeServer builds a multi-level folder tree (so largestRootFolder has many
// descendants), grants team:0 view on that root folder, and optionally persists user:1#member#team:0.
func setupContextualTeamListLargeServer(b *testing.B, withStoredUserTeam bool) (*Server, *benchmarkData) {
	b.Helper()
	if testing.Short() {
		b.Skip("skipping benchmark in short mode")
	}
	cfg := setting.NewCfg()
	cfg.ZanzanaServer.ContextualTeamsChunkSize = 25
	cfg.ZanzanaServer.CacheSettings.CheckCacheLimit = 10000
	cfg.ZanzanaServer.CacheSettings.CheckQueryCacheEnabled = true

	testStore := sqlstore.NewTestStore(b, sqlstore.WithCfg(cfg))
	store, err := zStore.NewEmbeddedStore(cfg, testStore, log.NewNopLogger())
	require.NoError(b, err)

	srv, err := NewEmbeddedZanzanaServer(cfg, store, log.NewNopLogger(), tracing.NewNoopTracerService(), prometheus.NewRegistry(), nil, nil)
	require.NoError(b, err)

	// 2 children/level, 5 levels deep => >60 folders; largest root has a large descendant count.
	folderTuples, data := generateFolderHierarchy(2, 5)
	teamID := 0
	teamMember := fmt.Sprintf("team:%d#member", teamID)
	perm := append(append([]*openfgav1.TupleKey{}, folderTuples...), common.NewFolderTuple(teamMember, common.RelationSetView, data.largestRootFolder))
	if withStoredUserTeam {
		perm = append(perm, common.NewTypedTuple(common.TypeTeam, "user:1", common.RelationTeamMember, fmt.Sprintf("%d", teamID)))
	}
	ctxW := newContextWithZanzanaUpdatePermission()
	st, err := srv.getStoreInfo(ctxW, contextualTeamBenchNS)
	require.NoError(b, err)
	for i := 0; i < len(perm); i += 100 {
		end := i + 100
		if end > len(perm) {
			end = len(perm)
		}
		_, err = srv.openFGAClient.Write(ctxW, &openfgav1.WriteRequest{
			StoreId:              st.ID,
			AuthorizationModelId: st.ModelID,
			Writes:               &openfgav1.WriteRequestWrites{TupleKeys: perm[i:end], OnDuplicate: "ignore"},
		})
		require.NoError(b, err)
	}
	generateResources(data, 20)
	generateUsers(data, 2)
	return srv, data
}

// setupContextualTeamBenchServer creates a small folder tree, grants team:0 view on a folder, and
// when withStoredUserTeam is true, persists user:1 -> member -> team:0.
func setupContextualTeamBenchServer(b *testing.B, withStoredUserTeam bool) (*Server, *benchmarkData) {
	b.Helper()
	if testing.Short() {
		b.Skip("skipping benchmark in short mode")
	}
	cfg := setting.NewCfg()
	cfg.ZanzanaServer.ContextualTeamsChunkSize = 25
	cfg.ZanzanaServer.CacheSettings.CheckCacheLimit = 10000
	cfg.ZanzanaServer.CacheSettings.CheckQueryCacheEnabled = true

	testStore := sqlstore.NewTestStore(b, sqlstore.WithCfg(cfg))
	store, err := zStore.NewEmbeddedStore(cfg, testStore, log.NewNopLogger())
	require.NoError(b, err)

	srv, err := NewEmbeddedZanzanaServer(cfg, store, log.NewNopLogger(), tracing.NewNoopTracerService(), prometheus.NewRegistry(), nil, nil)
	require.NoError(b, err)

	folderTuples, data := generateFolderHierarchy(1, 1)
	folderUID := data.folders[0]

	teamID := 0
	teamMember := fmt.Sprintf("team:%d#member", teamID)
	perm := []*openfgav1.TupleKey{
		folderTuples[0],
		common.NewFolderTuple(teamMember, common.RelationSetView, folderUID),
	}
	if withStoredUserTeam {
		perm = append(perm, common.NewTypedTuple(common.TypeTeam, "user:1", common.RelationTeamMember, fmt.Sprintf("%d", teamID)))
	}
	ctxW := newContextWithZanzanaUpdatePermission()
	st, err := srv.getStoreInfo(ctxW, contextualTeamBenchNS)
	require.NoError(b, err)
	_, err = srv.openFGAClient.Write(ctxW, &openfgav1.WriteRequest{
		StoreId:              st.ID,
		AuthorizationModelId: st.ModelID,
		Writes:               &openfgav1.WriteRequestWrites{TupleKeys: perm, OnDuplicate: "ignore"},
	})
	require.NoError(b, err)
	generateResources(data, 10)
	generateUsers(data, 2)
	return srv, data
}

func newBenchCtxWithTeams(nTeams int) context.Context {
	teams := make([]string, 0, nTeams)
	for i := 0; i < nTeams; i++ {
		teams = append(teams, fmt.Sprintf("%d", i))
	}
	return newContextWithGroups(teams...)
}

// BenchmarkContextualTeamCheck measures Check when team membership is stored vs contextual (same effective teams).
func BenchmarkContextualTeamCheck(b *testing.B) {
	teamSizes := []int{1, 10, 50, 100}
	for _, n := range teamSizes {
		b.Run(fmt.Sprintf("Teams_%d/Stored", n), func(b *testing.B) {
			srv, d := setupContextualTeamBenchServer(b, true)
			_ = n
			ctx := newContextWithNamespace()
			folder := d.folders[0]
			name := d.resources[0]
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				_, err := srv.Check(ctx, &authzv1.CheckRequest{
					Namespace: contextualTeamBenchNS,
					Subject:   "user:1",
					Verb:      utils.VerbGet,
					Group:     benchDashboardGroup,
					Resource:  benchDashboardResource,
					Folder:    folder,
					Name:      name,
				})
				if err != nil {
					b.Fatal(err)
				}
			}
		})
	}
	for _, n := range teamSizes {
		n := n
		b.Run(fmt.Sprintf("Teams_%d/Contextual_WarmCache", n), func(b *testing.B) {
			srv, d := setupContextualTeamBenchServer(b, false)
			ctx := newBenchCtxWithTeams(n)
			folder := d.folders[0]
			name := d.resources[0]
			// warm: one call before timer
			_, err := srv.Check(ctx, &authzv1.CheckRequest{
				Namespace: contextualTeamBenchNS,
				Subject:   "user:1",
				Verb:      utils.VerbGet,
				Group:     benchDashboardGroup,
				Resource:  benchDashboardResource,
				Folder:    folder,
				Name:      name,
			})
			if err != nil {
				b.Fatal(err)
			}
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				_, err := srv.Check(ctx, &authzv1.CheckRequest{
					Namespace: contextualTeamBenchNS,
					Subject:   "user:1",
					Verb:      utils.VerbGet,
					Group:     benchDashboardGroup,
					Resource:  benchDashboardResource,
					Folder:    folder,
					Name:      name,
				})
				if err != nil {
					b.Fatal(err)
				}
			}
		})
		b.Run(fmt.Sprintf("Teams_%d/Contextual_ColdCache", n), func(b *testing.B) {
			srv, d := setupContextualTeamBenchServer(b, false)
			ctx := newBenchCtxWithTeams(n)
			folder := d.folders[0]
			name := d.resources[0]
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				srv.cache.Flush()
				_, err := srv.Check(ctx, &authzv1.CheckRequest{
					Namespace: contextualTeamBenchNS,
					Subject:   "user:1",
					Verb:      utils.VerbGet,
					Group:     benchDashboardGroup,
					Resource:  benchDashboardResource,
					Folder:    folder,
					Name:      name,
				})
				if err != nil {
					b.Fatal(err)
				}
			}
		})
	}
}

// BenchmarkContextualTeamList is a listObjects-heavy path (folder list) with many contextual teams.
func BenchmarkContextualTeamList(b *testing.B) {
	for _, n := range []int{1, 10, 50, 100} {
		n := n
		b.Run(fmt.Sprintf("Root_Teams_%d", n), func(b *testing.B) {
			srv, _ := setupContextualTeamBenchServer(b, false)
			ctx := newBenchCtxWithTeams(n)
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				_, err := srv.List(ctx, &authzv1.ListRequest{
					Namespace: contextualTeamBenchNS,
					Subject:   "user:1",
					Verb:      utils.VerbGet,
					Group:     benchFolderGroup,
					Resource:  benchFolderResource,
				})
				if err != nil {
					b.Fatal(err)
				}
			}
		})
	}
}

// BenchmarkContextualTeamListLargeTree runs List over a >60-folder tree; team:0 is granted on largestRootFolder
// (authz ListRequest is not folder-scoped; a deep tree still expands listObjects work for visible folders).
func BenchmarkContextualTeamListLargeTree(b *testing.B) {
	for _, n := range []int{1, 100} {
		n := n
		b.Run(fmt.Sprintf("Teams_%d", n), func(b *testing.B) {
			srv, _ := setupContextualTeamListLargeServer(b, false)
			ctx := newBenchCtxWithTeams(n)
			_, err := srv.List(ctx, &authzv1.ListRequest{
				Namespace: contextualTeamBenchNS,
				Subject:   "user:1",
				Verb:      utils.VerbGet,
				Group:     benchFolderGroup,
				Resource:  benchFolderResource,
			})
			if err != nil {
				b.Fatal(err)
			}
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				_, err := srv.List(ctx, &authzv1.ListRequest{
					Namespace: contextualTeamBenchNS,
					Subject:   "user:1",
					Verb:      utils.VerbGet,
					Group:     benchFolderGroup,
					Resource:  benchFolderResource,
				})
				if err != nil {
					b.Fatal(err)
				}
			}
		})
	}
}

// BenchmarkContextualTeamBatchCheck issues a small batch against the minimal team-folder dataset.
func BenchmarkContextualTeamBatchCheck(b *testing.B) {
	for _, n := range []int{1, 10, 50, 100} {
		n := n
		b.Run(fmt.Sprintf("Teams_%d", n), func(b *testing.B) {
			srv, data := setupContextualTeamBenchServer(b, false)
			ctx := newBenchCtxWithTeams(n)
			var items []*authzv1.BatchCheckItem
			for i, name := range data.resources {
				if i >= 10 {
					break
				}
				items = append(items, &authzv1.BatchCheckItem{
					Verb:          utils.VerbGet,
					Group:         benchDashboardGroup,
					Resource:      benchDashboardResource,
					Name:          name,
					Folder:        data.resourceFolders[name],
					CorrelationId: fmt.Sprintf("c-%d", i),
				})
			}
			_, err := srv.BatchCheck(ctx, &authzv1.BatchCheckRequest{
				Namespace: contextualTeamBenchNS,
				Subject:   "user:1",
				Checks:    items,
			})
			if err != nil {
				b.Fatal(err)
			}
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				_, err := srv.BatchCheck(ctx, &authzv1.BatchCheckRequest{
					Namespace: contextualTeamBenchNS,
					Subject:   "user:1",
					Checks:    items,
				})
				if err != nil {
					b.Fatal(err)
				}
			}
		})
	}
}
