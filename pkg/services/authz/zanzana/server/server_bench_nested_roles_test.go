package server

import (
	"context"
	"fmt"
	"strings"
	"testing"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/openfga/language/pkg/go/transformer"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/leaderelection"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/schema"
	zStore "github.com/grafana/grafana/pkg/services/authz/zanzana/store"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

// This file compares the production role.assignee definition against a variant that
// re-adds nested roles, so the cost of that capability stays measurable after its
// removal. Nested roles were dropped because role#assignee referencing itself made
// the relation self-referential, which cost ListObjects reverse expansion ~20-30%
// on cold caches while forward Check was unaffected.

// The role.assignee type restriction in schema_core.fga. Production is flat; the
// nested variant re-adds role#assignee so the two can still be compared.
const (
	flatRoleAssigneeDef   = "define assignee: [user, service-account, anonymous, team#member]"
	nestedRoleAssigneeDef = "define assignee: [user, service-account, anonymous, team#member, role#assignee]"
)

const (
	roleBenchFolders          = 200
	roleBenchUsers            = 500
	roleBenchRoles            = 200
	roleBenchAssigneesPerRole = 5

	// Roles granted to the List subject, i.e. the expected List result size.
	roleBenchListRoles = 50

	// Longest role -> role chain built by the fixture.
	roleBenchMaxChainLen = 5
)

// schemaWithNestedRoles returns the production schema with role#assignee added back
// to role.assignee, so a role can be assigned to another role. This is the variant
// arm of the comparison; production is the flat schema.
func schemaWithNestedRoles(tb testing.TB) []transformer.ModuleFile {
	tb.Helper()

	modules := make([]transformer.ModuleFile, len(schema.SchemaModules))
	patched := 0
	for i, module := range schema.SchemaModules {
		modules[i] = module

		occurrences := strings.Count(module.Contents, flatRoleAssigneeDef)
		if occurrences == 0 {
			continue
		}
		require.Equal(tb, 1, occurrences, "%s declares role.assignee more than once", module.Name)

		modules[i].Contents = strings.Replace(module.Contents, flatRoleAssigneeDef, nestedRoleAssigneeDef, 1)
		patched++
	}

	require.Equal(tb, 1, patched,
		"no module declares %q - schema_core.fga changed and this benchmark needs updating", flatRoleAssigneeDef)

	return modules
}

// roleChain is a folder grant reachable only by traversing len(roles)-1 role -> role hops.
type roleChain struct {
	folder string
	user   string
	roles  []string
}

type roleBenchData struct {
	folders []string
	users   []string

	// Direct role assignment: flatUser is an assignee of a role holding a view
	// grant on flatFolder. Resolves identically under both schema variants.
	flatUser   string
	flatFolder string

	// Subject holding roleBenchListRoles role-based folder grants.
	listUser string

	// Subject with no tuples at all, for the non-short-circuiting denial path.
	deniedUser string

	// Nested chains keyed by hop count.
	chains map[int]roleChain
}

func roleAssigneeIdent(role string) string {
	return fmt.Sprintf("%s#%s", common.NewTypedIdent(common.TypeRole, role), common.RelationAssignee)
}

// generateRoleBenchTuples builds a role-centric fixture. Folders are deliberately
// flat (no parent tuples) so that folder inheritance cost does not mask the role
// resolution cost under test; folder depth is covered by BenchmarkCheck.
func generateRoleBenchTuples() ([]*openfgav1.TupleKey, *roleBenchData) {
	data := &roleBenchData{
		folders:    make([]string, 0, roleBenchFolders),
		users:      make([]string, 0, roleBenchUsers),
		deniedUser: "user:role-bench-denied",
		listUser:   "user:role-bench-list",
		chains:     make(map[int]roleChain, roleBenchMaxChainLen+1),
	}
	tuples := make([]*openfgav1.TupleKey, 0, roleBenchRoles*(roleBenchAssigneesPerRole+1))

	for i := range roleBenchFolders {
		data.folders = append(data.folders, fmt.Sprintf("role-bench-folder-%d", i))
	}
	for i := range roleBenchUsers {
		data.users = append(data.users, fmt.Sprintf("user:role-bench-%d", i))
	}

	// Flat roles: a view grant on one folder plus direct user assignees.
	for i := range roleBenchRoles {
		role := fmt.Sprintf("role-bench-%d", i)
		folder := data.folders[i%len(data.folders)]

		tuples = append(tuples, common.NewFolderTuple(roleAssigneeIdent(role), common.RelationSetView, folder))

		for j := range roleBenchAssigneesPerRole {
			user := data.users[(i*roleBenchAssigneesPerRole+j)%len(data.users)]
			tuples = append(tuples, common.NewTypedTuple(common.TypeRole, user, common.RelationAssignee, role))
		}
	}
	data.flatUser = data.users[0]
	data.flatFolder = data.folders[0]

	// A subject with many role-based grants, so List has real work to do.
	for i := range roleBenchListRoles {
		role := fmt.Sprintf("role-bench-list-%d", i)
		folder := data.folders[i%len(data.folders)]

		tuples = append(tuples,
			common.NewFolderTuple(roleAssigneeIdent(role), common.RelationSetView, folder),
			common.NewTypedTuple(common.TypeRole, data.listUser, common.RelationAssignee, role),
		)
	}

	// Nested chains: the folder grant sits on the head role, the user on the tail,
	// so resolving it costs `hops` extra role -> role dispatches.
	for hops := 0; hops <= roleBenchMaxChainLen; hops++ {
		chain := roleChain{
			folder: fmt.Sprintf("role-bench-chain-folder-%d", hops),
			user:   fmt.Sprintf("user:role-bench-chain-%d", hops),
			roles:  make([]string, 0, hops+1),
		}
		for link := range hops + 1 {
			chain.roles = append(chain.roles, fmt.Sprintf("role-bench-chain-%d-%d", hops, link))
		}

		tuples = append(tuples, common.NewFolderTuple(roleAssigneeIdent(chain.roles[0]), common.RelationSetView, chain.folder))
		for link := range hops {
			tuples = append(tuples, common.NewTypedTuple(
				common.TypeRole,
				roleAssigneeIdent(chain.roles[link+1]),
				common.RelationAssignee,
				chain.roles[link],
			))
		}
		tuples = append(tuples, common.NewTypedTuple(common.TypeRole, chain.user, common.RelationAssignee, chain.roles[hops]))

		data.chains[hops] = chain
	}

	return tuples, data
}

type roleBenchOpts struct {
	// nestedRolesInModel selects the active authorization model. Tuples are always
	// written under the nested-capable model (see setupRoleSchemaBenchmark).
	nestedRolesInModel bool
	// withCache mirrors production cache settings. Leave false to measure
	// evaluation cost rather than cache hits.
	withCache bool
}

func (o roleBenchOpts) label() string {
	model := "FlatRoles"
	if o.nestedRolesInModel {
		model = "NestedRoles"
	}
	cache := "NoCache"
	if o.withCache {
		cache = "Cache"
	}
	return model + "/" + cache
}

// setupRoleSchemaBenchmark builds an identical tuple set for both schema variants.
//
// OpenFGA validates tuples against the active model on write, so role -> role tuples
// are only writable under the nested-capable model. Tuples are therefore always
// written under that model, and the model is swapped back to production afterwards
// unless the nested arm was requested. That keeps the two arms tuple-identical, and
// it reproduces the real post-migration state: nested tuples still present in
// storage but no longer resolvable.
func setupRoleSchemaBenchmark(tb testing.TB, opts roleBenchOpts) (*Server, *roleBenchData) {
	tb.Helper()

	cfg := setting.NewCfg()
	cfg.ZanzanaServer.ListObjectsDeadline = listTimeout

	if opts.withCache {
		cfg.ZanzanaServer.CacheSettings.CheckCacheLimit = 100000
		cfg.ZanzanaServer.CacheSettings.CheckQueryCacheEnabled = true
		cfg.ZanzanaServer.CacheSettings.CheckIteratorCacheEnabled = true
		cfg.ZanzanaServer.CacheSettings.CheckIteratorCacheMaxResults = 10000
		cfg.ZanzanaServer.CacheSettings.SharedIteratorEnabled = true
		cfg.ZanzanaServer.CacheSettings.SharedIteratorLimit = 10000
	} else {
		// Explicit: repeating the same Check b.N times would otherwise measure
		// cache hits, which hides a model-shape difference this small.
		cfg.ZanzanaServer.CacheSettings.CheckCacheLimit = 0
		cfg.ZanzanaServer.CacheSettings.CheckQueryCacheEnabled = false
		cfg.ZanzanaServer.CacheSettings.CheckIteratorCacheEnabled = false
		cfg.ZanzanaServer.CacheSettings.SharedIteratorEnabled = false
	}

	testStore := sqlstore.NewTestStore(tb, sqlstore.WithCfg(cfg))

	store, err := zStore.NewEmbeddedStore(cfg, testStore, log.NewNopLogger())
	require.NoError(tb, err)

	srv, err := NewEmbeddedZanzanaServer(cfg, store, log.NewNopLogger(), tracing.NewNoopTracerService(), prometheus.NewRegistry(), nil, nil, leaderelection.NewDefaultElector())
	require.NoError(tb, err)

	tuples, data := generateRoleBenchTuples()

	ctx := newContextWithZanzanaUpdatePermission()
	storeInf, err := srv.getStoreInfo(ctx, benchNamespace)
	require.NoError(tb, err)

	nestedModelID := switchAuthorizationModel(tb, srv, benchNamespace, storeInf.ID, schemaWithNestedRoles(tb))
	writeTuplesInBatches(tb, srv, storeInf.ID, nestedModelID, tuples)

	if !opts.nestedRolesInModel {
		switchAuthorizationModel(tb, srv, benchNamespace, storeInf.ID, schema.SchemaModules)
	}

	tb.Logf("role benchmark fixture: model=%s, %d tuples, %d folders, %d roles, %d users, chains up to %d hops",
		map[bool]string{true: "nested", false: "flat"}[opts.nestedRolesInModel],
		len(tuples), len(data.folders), roleBenchRoles, len(data.users), roleBenchMaxChainLen)

	return srv, data
}

func writeTuplesInBatches(tb testing.TB, srv *Server, storeID, modelID string, tuples []*openfgav1.TupleKey) {
	tb.Helper()

	ctx := newContextWithZanzanaUpdatePermission()
	const batchSize = 100

	for start := 0; start < len(tuples); start += batchSize {
		end := min(start+batchSize, len(tuples))

		_, err := srv.openFGAClient.Write(ctx, &openfgav1.WriteRequest{
			StoreId:              storeID,
			AuthorizationModelId: modelID,
			Writes: &openfgav1.WriteRequestWrites{
				TupleKeys:   tuples[start:end],
				OnDuplicate: "ignore",
			},
		})
		require.NoError(tb, err)
	}
}

// switchAuthorizationModel writes modules as a new model and repoints the server's
// cached store info at it, so subsequent requests evaluate against it.
func switchAuthorizationModel(tb testing.TB, srv *Server, namespace, storeID string, modules []transformer.ModuleFile) string {
	tb.Helper()

	modelID, err := srv.loadModel(newContextWithZanzanaUpdatePermission(), storeID, modules)
	require.NoError(tb, err)

	srv.storesMU.Lock()
	info := srv.stores[namespace]
	info.ModelID = modelID
	srv.stores[namespace] = info
	srv.storesMU.Unlock()

	return modelID
}

func newFolderCheckReq(subject, folder string) *authzv1.CheckRequest {
	return &authzv1.CheckRequest{
		Namespace: benchNamespace,
		Subject:   subject,
		Verb:      utils.VerbGet,
		Group:     benchFolderGroup,
		Resource:  benchFolderResource,
		Name:      folder,
	}
}

func roleSchemaVariants() []roleBenchOpts {
	return []roleBenchOpts{
		{nestedRolesInModel: true, withCache: false},
		{nestedRolesInModel: false, withCache: false},
		{nestedRolesInModel: true, withCache: true},
		{nestedRolesInModel: false, withCache: true},
	}
}

// BenchmarkRoleSchemaCheck compares Check with and without nested roles in the model.
//
// Both sub-benchmarks are chosen so the *result* is identical under both variants,
// which is what makes the timings comparable:
//   - FlatRoleAllowed: allowed via a direct role assignment (short-circuits).
//   - Denied: denied, so no branch short-circuits and the whole tree is exhausted.
//     This is where an extra allowed userset type has to show up if it costs anything.
func BenchmarkRoleSchemaCheck(b *testing.B) {
	for _, opts := range roleSchemaVariants() {
		b.Run(opts.label(), func(b *testing.B) {
			srv, data := setupRoleSchemaBenchmark(b, opts)
			ctx := newContextWithNamespace()

			b.Run("FlatRoleAllowed", func(b *testing.B) {
				req := newFolderCheckReq(data.flatUser, data.flatFolder)

				b.ReportAllocs()
				b.ResetTimer()
				for range b.N {
					res, err := srv.Check(ctx, req)
					if err != nil {
						b.Fatal(err)
					}
					if !res.GetAllowed() {
						b.Fatal("expected direct role assignment to grant access")
					}
				}
			})

			b.Run("Denied", func(b *testing.B) {
				req := newFolderCheckReq(data.deniedUser, data.flatFolder)

				b.ReportAllocs()
				b.ResetTimer()
				for range b.N {
					res, err := srv.Check(ctx, req)
					if err != nil {
						b.Fatal(err)
					}
					if res.GetAllowed() {
						b.Fatal("expected subject without tuples to be denied")
					}
				}
			})
		})
	}
}

// BenchmarkRoleSchemaBatchCheck amplifies the per-check difference across a batch.
//
// Items are resources inside folders (not folder objects), because that is the shape
// that routes through resolveFolderChecks and therefore honours
// FolderCheckBatchThreshold. Both strategies are forced explicitly since they use
// different engines: resolveFolderChecksByBatch fans out Check calls, while
// resolveFolderChecksByList goes through ListObjects reverse expansion.
func BenchmarkRoleSchemaBatchCheck(b *testing.B) {
	strategies := []struct {
		name      string
		threshold int
	}{
		{name: "NativeBatchCheck", threshold: batchCheckSize + 1},
		{name: "ListObjects", threshold: 1},
	}

	for _, opts := range roleSchemaVariants() {
		b.Run(opts.label(), func(b *testing.B) {
			srv, data := setupRoleSchemaBenchmark(b, opts)
			ctx := newContextWithNamespace()

			// Folders 0..batchCheckSize-1 are exactly the ones granted to listUser
			// through roles, so every item is allowed for that subject.
			items := make([]*authzv1.BatchCheckItem, 0, batchCheckSize)
			for i := range batchCheckSize {
				items = append(items, &authzv1.BatchCheckItem{
					Verb:          utils.VerbGet,
					Group:         benchDashboardGroup,
					Resource:      benchDashboardResource,
					Name:          fmt.Sprintf("role-bench-resource-%d", i),
					Folder:        data.folders[i%len(data.folders)],
					CorrelationId: fmt.Sprintf("item-%d", i),
				})
			}

			for _, strategy := range strategies {
				b.Run(strategy.name, func(b *testing.B) {
					previous := srv.cfg.FolderCheckBatchThreshold
					srv.cfg.FolderCheckBatchThreshold = strategy.threshold
					defer func() { srv.cfg.FolderCheckBatchThreshold = previous }()

					for _, subject := range []struct {
						name string
						user string
					}{
						{name: "Denied", user: data.deniedUser},
						{name: "RoleGranted", user: data.listUser},
					} {
						b.Run(subject.name, func(b *testing.B) {
							req := &authzv1.BatchCheckRequest{
								Namespace: benchNamespace,
								Subject:   subject.user,
								Checks:    items,
							}

							b.ReportAllocs()
							b.ResetTimer()
							for range b.N {
								res, err := srv.BatchCheck(ctx, req)
								if err != nil {
									b.Fatal(err)
								}
								_ = res.Results
							}
						})
					}
				})
			}
		})
	}
}

// BenchmarkRoleSchemaList covers reverse expansion, where the self-referential
// role#assignee type introduces a cycle in the type graph that ListObjects must
// handle. If removing nested roles helps anywhere, it should be most visible here.
func BenchmarkRoleSchemaList(b *testing.B) {
	for _, opts := range roleSchemaVariants() {
		b.Run(opts.label(), func(b *testing.B) {
			srv, data := setupRoleSchemaBenchmark(b, opts)
			baseCtx := newContextWithNamespace()

			for _, subject := range []struct {
				name string
				user string
			}{
				{name: "RoleGranted", user: data.listUser},
				{name: "NoAccess", user: data.deniedUser},
			} {
				b.Run(subject.name, func(b *testing.B) {
					req := &authzv1.ListRequest{
						Namespace: benchNamespace,
						Subject:   subject.user,
						Verb:      utils.VerbGet,
						Group:     benchFolderGroup,
						Resource:  benchFolderResource,
					}

					ctx, cancel := context.WithTimeout(baseCtx, listTimeout)
					res, err := srv.List(ctx, req)
					cancel()
					require.NoError(b, err)
					b.Logf("List returned %d folders, %d items, all=%v",
						len(res.GetFolders()), len(res.GetItems()), res.GetAll())

					b.ReportAllocs()
					b.ResetTimer()
					for range b.N {
						ctx, cancel := context.WithTimeout(baseCtx, listTimeout)
						_, err := srv.List(ctx, req)
						cancel()
						if err != nil {
							b.Fatal(err)
						}
					}
				})
			}
		})
	}
}

// BenchmarkRoleChainDepth measures what the nested-role capability costs when it is
// actually used: each hop is an extra dispatch round. Runs only on the nested model,
// since these grants do not resolve at all without it.
func BenchmarkRoleChainDepth(b *testing.B) {
	for _, withCache := range []bool{false, true} {
		opts := roleBenchOpts{nestedRolesInModel: true, withCache: withCache}

		b.Run(opts.label(), func(b *testing.B) {
			srv, data := setupRoleSchemaBenchmark(b, opts)
			ctx := newContextWithNamespace()

			for hops := 0; hops <= roleBenchMaxChainLen; hops++ {
				chain := data.chains[hops]

				b.Run(fmt.Sprintf("Hops%d", hops), func(b *testing.B) {
					req := newFolderCheckReq(chain.user, chain.folder)

					res, err := srv.Check(ctx, req)
					require.NoError(b, err)
					require.True(b, res.GetAllowed(), "chain of %d hops should resolve on the nested model", hops)

					b.ReportAllocs()
					b.ResetTimer()
					for range b.N {
						res, err := srv.Check(ctx, req)
						if err != nil {
							b.Fatal(err)
						}
						if !res.GetAllowed() {
							b.Fatal("expected nested role chain to grant access")
						}
					}
				})
			}
		})
	}
}

// TestIntegrationRolesAreNotNestable guards that the production schema keeps roles
// flat, and documents the blast radius of that choice: direct assignments work,
// existing role -> role tuples silently stop resolving, and new ones are rejected at
// write time. GetRoleBindingTuple only accepts user, team and service-account
// subjects, so nothing in Grafana can create these tuples.
func TestIntegrationRolesAreNotNestable(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	srv, data := setupRoleSchemaBenchmark(t, roleBenchOpts{nestedRolesInModel: false})
	ctx := newContextWithNamespace()

	t.Run("direct role assignment still resolves", func(t *testing.T) {
		res, err := srv.Check(ctx, newFolderCheckReq(data.flatUser, data.flatFolder))
		require.NoError(t, err)
		require.True(t, res.GetAllowed())
	})

	t.Run("existing nested grants stop resolving", func(t *testing.T) {
		for hops := 1; hops <= roleBenchMaxChainLen; hops++ {
			chain := data.chains[hops]
			res, err := srv.Check(ctx, newFolderCheckReq(chain.user, chain.folder))
			require.NoError(t, err)
			require.False(t, res.GetAllowed(),
				"nested chain of %d hops unexpectedly resolved without role#assignee", hops)
		}
	})

	t.Run("zero-hop chains are unaffected", func(t *testing.T) {
		chain := data.chains[0]
		res, err := srv.Check(ctx, newFolderCheckReq(chain.user, chain.folder))
		require.NoError(t, err)
		require.True(t, res.GetAllowed())
	})

	t.Run("new role to role tuples are rejected", func(t *testing.T) {
		writeCtx := newContextWithZanzanaUpdatePermission()
		storeInf, err := srv.getStoreInfo(writeCtx, benchNamespace)
		require.NoError(t, err)

		_, err = srv.openFGAClient.Write(writeCtx, &openfgav1.WriteRequest{
			StoreId:              storeInf.ID,
			AuthorizationModelId: storeInf.ModelID,
			Writes: &openfgav1.WriteRequestWrites{
				TupleKeys: []*openfgav1.TupleKey{
					common.NewTypedTuple(
						common.TypeRole,
						roleAssigneeIdent("role-bench-1"),
						common.RelationAssignee,
						"role-bench-0",
					),
				},
			},
		})
		require.Error(t, err, "flat model should reject role -> role assignment")
	})
}
