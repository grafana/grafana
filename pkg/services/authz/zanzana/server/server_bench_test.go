package server

import (
	"context"
	"fmt"
	"math/rand"
	"testing"
	"time"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/store"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	benchNamespace = "default"

	// Folder tree parameters
	foldersPerLevel = 3
	folderDepth     = 7

	// Other data generation parameters
	numResources = 50000
	numUsers     = 1000
	numTeams     = 100

	// Timeout for List operations
	listTimeout = 30 * time.Second

	// BenchmarkBatchCheck measures the performance of BatchCheck requests with 50 items per batch.
	batchCheckSize = 50

	// Resource type constants for benchmarks
	benchDashboardGroup    = "dashboard.grafana.app"
	benchDashboardResource = "dashboards"
	benchFolderGroup       = "folder.grafana.app"
	benchFolderResource    = "folders"
)

// benchmarkData holds all the generated test data for benchmarks
type benchmarkData struct {
	folders           []string          // folder UIDs
	folderDepths      map[string]int    // folder UID -> depth level
	folderParents     map[string]string // folder UID -> parent UID
	folderDescendants map[string]int    // folder UID -> number of descendants (including self)
	foldersByDepth    [][]string        // folders grouped by depth level
	resources         []string          // resource names
	resourceFolders   map[string]string // resource name -> folder UID
	users             []string          // user identifiers (e.g., "user:1")
	teams             []string          // team identifiers (e.g., "team:1")

	// Pre-computed test scenarios
	deepestFolder        string // folder at max depth for worst-case tests
	midDepthFolder       string // folder at depth/2
	shallowFolder        string // folder at depth 1
	rootFolder           string // root level folder (depth 0)
	largestRootFolder    string // root folder with most descendants
	largestRootDescCount int    // number of descendants in largestRootFolder
	maxDepth             int    // maximum depth in the tree
}

// generateFolderHierarchy creates a balanced tree of folders.
// Each folder has `childrenPerFolder` children, up to `depth` levels deep.
func generateFolderHierarchy(childrenPerFolder, depth int) ([]*openfgav1.TupleKey, *benchmarkData) {
	// Calculate total folders: childrenPerFolder + childrenPerFolder^2 + ... + childrenPerFolder^(depth+1)
	totalFolders := 0
	levelSize := childrenPerFolder
	for d := 0; d <= depth; d++ {
		totalFolders += levelSize
		levelSize *= childrenPerFolder
	}

	data := &benchmarkData{
		folders:           make([]string, 0, totalFolders),
		folderDepths:      make(map[string]int),
		folderParents:     make(map[string]string),
		folderDescendants: make(map[string]int),
	}
	tuples := make([]*openfgav1.TupleKey, 0, totalFolders)

	folderIdx := 0

	// Track folders at each level for parent assignment
	levelFolders := make([][]string, depth+1)
	for i := range levelFolders {
		levelFolders[i] = make([]string, 0)
	}

	// Create root level folders (depth 0)
	for i := 0; i < childrenPerFolder; i++ {
		folderUID := fmt.Sprintf("folder-%d", folderIdx)
		data.folders = append(data.folders, folderUID)
		data.folderDepths[folderUID] = 0
		levelFolders[0] = append(levelFolders[0], folderUID)
		folderIdx++
	}

	// Create folders at each subsequent depth level
	for d := 1; d <= depth; d++ {
		parentFolders := levelFolders[d-1]

		// Each parent gets exactly childrenPerFolder children
		for _, parentUID := range parentFolders {
			for j := 0; j < childrenPerFolder; j++ {
				folderUID := fmt.Sprintf("folder-%d", folderIdx)

				data.folders = append(data.folders, folderUID)
				data.folderDepths[folderUID] = d
				data.folderParents[folderUID] = parentUID
				levelFolders[d] = append(levelFolders[d], folderUID)

				// Create parent relationship tuple
				tuples = append(tuples, common.NewFolderParentTuple(folderUID, parentUID))
				folderIdx++
			}
		}
	}

	// Set reference folders for different depth scenarios
	data.rootFolder = levelFolders[0][0]
	data.shallowFolder = levelFolders[0][0]
	if len(levelFolders[1]) > 0 {
		data.shallowFolder = levelFolders[1][0]
	}
	midDepth := depth / 2
	if len(levelFolders[midDepth]) > 0 {
		data.midDepthFolder = levelFolders[midDepth][0]
	}
	// Deepest folder
	if len(levelFolders[depth]) > 0 {
		data.deepestFolder = levelFolders[depth][0]
	}

	// Calculate descendant counts for each folder (bottom-up)
	// Initialize all folders with count of 1 (self)
	for _, folder := range data.folders {
		data.folderDescendants[folder] = 1
	}
	// Process folders from deepest to shallowest, accumulating descendant counts
	for d := depth; d >= 0; d-- {
		for _, folder := range levelFolders[d] {
			if parent, hasParent := data.folderParents[folder]; hasParent {
				data.folderDescendants[parent] += data.folderDescendants[folder]
			}
		}
	}

	// Find root folder with most descendants
	for _, rootFolder := range levelFolders[0] {
		count := data.folderDescendants[rootFolder]
		if count > data.largestRootDescCount {
			data.largestRootDescCount = count
			data.largestRootFolder = rootFolder
		}
	}

	// Store folders by depth for depth-based testing
	data.foldersByDepth = levelFolders
	data.maxDepth = depth

	return tuples, data
}

// generateResources creates resources distributed across folders
func generateResources(data *benchmarkData, numResources int) []*openfgav1.TupleKey {
	data.resources = make([]string, numResources)
	data.resourceFolders = make(map[string]string, numResources)

	// Distribute resources across folders
	for i := 0; i < numResources; i++ {
		resourceName := fmt.Sprintf("resource-%d", i)
		folderIdx := i % len(data.folders)
		folderUID := data.folders[folderIdx]

		data.resources[i] = resourceName
		data.resourceFolders[resourceName] = folderUID
	}

	// Note: We don't create tuples for resources themselves,
	// permissions are assigned to users/teams on folders or directly on resources
	return nil
}

// generateUsers creates user identifiers
func generateUsers(data *benchmarkData, numUsers int) {
	data.users = make([]string, numUsers)
	for i := 0; i < numUsers; i++ {
		data.users[i] = fmt.Sprintf("user:%d", i)
	}
}

// generateTeams creates team identifiers
func generateTeams(data *benchmarkData, numTeams int) {
	data.teams = make([]string, numTeams)
	for i := 0; i < numTeams; i++ {
		data.teams[i] = fmt.Sprintf("team:%d", i)
	}
}

// generatePermissionTuples creates various permission assignments for benchmarking.
// Users are distributed across 7 patterns: global, root folder, mid-depth folder,
// folder-scoped resource, direct resource, team-based, and no permissions.
const numPermissionPatterns = 7

func generatePermissionTuples(data *benchmarkData) []*openfgav1.TupleKey {
	tuples := make([]*openfgav1.TupleKey, 0)

	// Distribute users across different permission patterns
	usersPerPattern := len(data.users) / numPermissionPatterns

	// Pattern 1: Users with GroupResource permission (all access)
	// Users 0 to usersPerPattern-1
	for i := 0; i < usersPerPattern; i++ {
		tuples = append(tuples, common.NewGroupResourceTuple(
			data.users[i],
			common.RelationGet,
			benchDashboardGroup,
			benchDashboardResource,
			"",
		))
	}

	// Pattern 2: Users with folder-level permission on root folders
	// Users usersPerPattern to 2*usersPerPattern-1
	for i := usersPerPattern; i < 2*usersPerPattern; i++ {
		folderIdx := (i - usersPerPattern) % len(data.folders)
		// Only assign to root-level folders for this pattern
		for j := folderIdx; j < len(data.folders); j++ {
			if data.folderDepths[data.folders[j]] == 0 {
				tuples = append(tuples, common.NewFolderTuple(
					data.users[i],
					common.RelationSetView,
					data.folders[j],
				))
				break
			}
		}
	}

	// Pattern 3: Users with folder-level permission on mid-depth folders
	// Use relative depth range: 1/3 to 2/3 of max depth
	// Use "view" relation which grants get through the optimized schema
	minMidDepth := data.maxDepth / 3
	maxMidDepth := 2 * data.maxDepth / 3
	if maxMidDepth < minMidDepth {
		maxMidDepth = minMidDepth
	}
	// Collect folders in the mid-depth range
	var midDepthFolders []string
	for d := minMidDepth; d <= maxMidDepth; d++ {
		if d < len(data.foldersByDepth) {
			midDepthFolders = append(midDepthFolders, data.foldersByDepth[d]...)
		}
	}
	// Fall back to root folders if no mid-depth folders exist
	if len(midDepthFolders) == 0 {
		midDepthFolders = data.foldersByDepth[0]
	}
	for i := 2 * usersPerPattern; i < 3*usersPerPattern; i++ {
		folderIdx := (i - 2*usersPerPattern) % len(midDepthFolders)
		tuples = append(tuples, common.NewFolderTuple(
			data.users[i],
			common.RelationSetView,
			midDepthFolders[folderIdx],
		))
	}

	// Pattern 4: Users with folder-scoped resource permission
	for i := 3 * usersPerPattern; i < 4*usersPerPattern; i++ {
		folderIdx := (i - 3*usersPerPattern) % len(data.folders)
		tuples = append(tuples, common.NewFolderResourceTuple(
			data.users[i],
			common.RelationGet,
			benchDashboardGroup,
			benchDashboardResource,
			"",
			data.folders[folderIdx],
		))
	}

	// Pattern 5: Users with direct resource permission
	for i := 4 * usersPerPattern; i < 5*usersPerPattern; i++ {
		resourceIdx := (i - 4*usersPerPattern) % len(data.resources)
		tuples = append(tuples, common.NewResourceTuple(
			data.users[i],
			common.RelationGet,
			benchDashboardGroup,
			benchDashboardResource,
			"",
			data.resources[resourceIdx],
		))
	}

	// Pattern 6: Team memberships and team permissions
	// First, add users to teams
	for i := 5 * usersPerPattern; i < 6*usersPerPattern && i < len(data.users); i++ {
		teamIdx := (i - 5*usersPerPattern) % len(data.teams)
		tuples = append(tuples, common.NewTypedTuple(
			common.TypeTeam,
			data.users[i],
			common.RelationTeamMember,
			fmt.Sprintf("%d", teamIdx),
		))
	}
	// Then, give teams folder permissions
	// Use "view" relation which grants get through the optimized schema
	for i := 0; i < len(data.teams); i++ {
		folderIdx := i % len(data.folders)
		teamMember := fmt.Sprintf("team:%d#member", i)
		tuples = append(tuples, common.NewFolderTuple(
			teamMember,
			common.RelationSetView,
			data.folders[folderIdx],
		))
	}

	// Pattern 7: Users with no permissions (remaining users)
	// These users don't get any tuples - they're for testing denial cases

	return tuples
}

// setupBenchmarkServer creates a server with the benchmark data loaded
func setupBenchmarkServer(b *testing.B) (*Server, *benchmarkData) {
	b.Helper()
	if testing.Short() {
		b.Skip("skipping benchmark in short mode")
	}

	cfg := setting.NewCfg()

	cfg.ZanzanaServer.CacheSettings.CheckCacheLimit = 100000             // Cache check results
	cfg.ZanzanaServer.CacheSettings.CheckQueryCacheEnabled = true        // Cache check subproblems
	cfg.ZanzanaServer.CacheSettings.CheckIteratorCacheEnabled = true     // Cache DB iterators for checks
	cfg.ZanzanaServer.CacheSettings.CheckIteratorCacheMaxResults = 10000 // Max results per iterator
	cfg.ZanzanaServer.CacheSettings.SharedIteratorEnabled = true         // Share iterators across concurrent checks
	cfg.ZanzanaServer.CacheSettings.SharedIteratorLimit = 10000          // Max shared iterators

	testStore := sqlstore.NewTestStore(b, sqlstore.WithCfg(cfg))

	openFGAStore, err := store.NewEmbeddedStore(cfg, testStore, log.NewNopLogger())
	require.NoError(b, err)

	openfga, err := NewOpenFGAServer(cfg.ZanzanaServer, openFGAStore)
	require.NoError(b, err)

	srv, err := NewServer(cfg.ZanzanaServer, openfga, log.NewNopLogger(), tracing.NewNoopTracerService(), prometheus.NewRegistry())
	require.NoError(b, err)

	// Generate test data
	b.Log("Generating folder hierarchy...")
	folderTuples, data := generateFolderHierarchy(foldersPerLevel, folderDepth)

	b.Log("Generating resources...")
	generateResources(data, numResources)

	b.Log("Generating users...")
	generateUsers(data, numUsers)

	b.Log("Generating teams...")
	generateTeams(data, numTeams)

	b.Log("Generating permission tuples...")
	permTuples := generatePermissionTuples(data)

	// Add special user with permission on largest root folder (for >1000 folder test)
	// Use "view" relation which grants get through the optimized schema
	largeRootUserTuple := common.NewFolderTuple(
		"user:large-root-access",
		common.RelationSetView,
		data.largestRootFolder,
	)
	permTuples = append(permTuples, largeRootUserTuple)

	// Add users with permissions at each depth level for depth-based testing
	// Use "view" relation which grants get through the optimized schema
	for depth := 0; depth <= data.maxDepth; depth++ {
		if len(data.foldersByDepth[depth]) == 0 {
			continue
		}
		folder := data.foldersByDepth[depth][0]
		user := fmt.Sprintf("user:depth-%d-access", depth)
		permTuples = append(permTuples, common.NewFolderTuple(user, common.RelationSetView, folder))
	}

	// Combine all tuples
	allTuples := append(folderTuples, permTuples...)

	b.Logf("Total tuples to write: %d", len(allTuples))

	// Get store info
	ctx := newContextWithZanzanaUpdatePermission()
	storeInf, err := srv.getStoreInfo(ctx, benchNamespace)
	require.NoError(b, err)

	// Write tuples in batches (OpenFGA limits to 100 per write)
	batchSize := 100
	for i := 0; i < len(allTuples); i += batchSize {
		end := i + batchSize
		if end > len(allTuples) {
			end = len(allTuples)
		}
		batch := allTuples[i:end]

		_, err = srv.openfga.Write(ctx, &openfgav1.WriteRequest{
			StoreId:              storeInf.ID,
			AuthorizationModelId: storeInf.ModelID,
			Writes: &openfgav1.WriteRequestWrites{
				TupleKeys:   batch,
				OnDuplicate: "ignore",
			},
		})
		require.NoError(b, err)

		if (i/batchSize)%100 == 0 {
			b.Logf("Written %d/%d tuples", end, len(allTuples))
		}
	}

	b.Logf("Benchmark data setup complete: %d folders, %d resources, %d users, %d teams",
		len(data.folders), len(data.resources), len(data.users), len(data.teams))
	b.Logf("Largest root folder: %s with %d descendants", data.largestRootFolder, data.largestRootDescCount)

	return srv, data
}

// BenchmarkCheck measures the performance of Check requests
func BenchmarkCheck(b *testing.B) {
	srv, data := setupBenchmarkServer(b)
	ctx := newContextWithNamespace()

	// Helper to create check requests
	newCheckReq := func(subject, verb, group, resource, folder, name string) *authzv1.CheckRequest {
		return &authzv1.CheckRequest{
			Namespace: benchNamespace,
			Subject:   subject,
			Verb:      verb,
			Group:     group,
			Resource:  resource,
			Folder:    folder,
			Name:      name,
		}
	}

	usersPerPattern := len(data.users) / 7

	b.Run("GroupResourceDirect", func(b *testing.B) {
		// User with group_resource permission - should have access to everything
		user := data.users[0] // First user has GroupResource permission
		resource := data.resources[rand.Intn(len(data.resources))]
		folder := data.resourceFolders[resource]

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			res, err := srv.Check(ctx, newCheckReq(user, utils.VerbGet, benchDashboardGroup, benchDashboardResource, folder, resource))
			if err != nil {
				b.Fatal(err)
			}
			if !res.GetAllowed() {
				b.Fatal("expected access to be allowed")
			}
		}
	})

	// Test folder inheritance at each depth level (0 to maxDepth)
	// User has permission on ROOT folder (depth 0), we check access at each deeper level
	rootUser := "user:depth-0-access" // has view permission on root folder
	for depth := 0; depth <= data.maxDepth; depth++ {
		depth := depth // capture for closure
		if len(data.foldersByDepth[depth]) == 0 {
			continue
		}
		b.Run(fmt.Sprintf("FolderInheritance/Depth%d", depth), func(b *testing.B) {
			resource := data.resources[0]
			folder := data.foldersByDepth[depth][0]

			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				res, err := srv.Check(ctx, newCheckReq(rootUser, utils.VerbGet, benchDashboardGroup, benchDashboardResource, folder, resource))
				if err != nil {
					b.Fatal(err)
				}
				_ = res.GetAllowed()
			}
		})
	}

	b.Run("FolderResourceScoped", func(b *testing.B) {
		// User with folder-scoped resource permission
		user := data.users[3*usersPerPattern]
		folderIdx := 0
		folder := data.folders[folderIdx]
		resource := data.resources[folderIdx]

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			res, err := srv.Check(ctx, newCheckReq(user, utils.VerbGet, benchDashboardGroup, benchDashboardResource, folder, resource))
			if err != nil {
				b.Fatal(err)
			}
			_ = res.GetAllowed()
		}
	})

	b.Run("DirectResource", func(b *testing.B) {
		// User with direct resource permission
		user := data.users[4*usersPerPattern]
		resourceIdx := 0
		resource := data.resources[resourceIdx]
		folder := data.resourceFolders[resource]

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			res, err := srv.Check(ctx, newCheckReq(user, utils.VerbGet, benchDashboardGroup, benchDashboardResource, folder, resource))
			if err != nil {
				b.Fatal(err)
			}
			_ = res.GetAllowed()
		}
	})

	b.Run("TeamMembership", func(b *testing.B) {
		// User who is a team member, team has folder permission
		user := data.users[5*usersPerPattern]
		teamIdx := 0
		folderIdx := teamIdx % len(data.folders)
		folder := data.folders[folderIdx]
		resource := data.resources[folderIdx%len(data.resources)]

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			res, err := srv.Check(ctx, newCheckReq(user, utils.VerbGet, benchDashboardGroup, benchDashboardResource, folder, resource))
			if err != nil {
				b.Fatal(err)
			}
			_ = res.GetAllowed()
		}
	})

	b.Run("NoAccess", func(b *testing.B) {
		// User with no permissions - tests denial path
		user := data.users[len(data.users)-1] // Last user has no permissions
		resource := data.resources[0]
		folder := data.resourceFolders[resource]

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			res, err := srv.Check(ctx, newCheckReq(user, utils.VerbGet, benchDashboardGroup, benchDashboardResource, folder, resource))
			if err != nil {
				b.Fatal(err)
			}
			if res.GetAllowed() {
				b.Fatal("expected access to be denied")
			}
		}
	})

	b.Run("FolderCheck", func(b *testing.B) {
		// Direct folder access check
		user := data.users[usersPerPattern]
		folder := data.rootFolder

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			res, err := srv.Check(ctx, newCheckReq(user, utils.VerbGet, benchFolderGroup, benchFolderResource, "", folder))
			if err != nil {
				b.Fatal(err)
			}
			_ = res.GetAllowed()
		}
	})
}

// BenchmarkBatchCheck measures the performance of BatchCheck requests
func BenchmarkBatchCheck(b *testing.B) {
	srv, data := setupBenchmarkServer(b)
	ctx := newContextWithNamespace()

	// Helper to create batch check requests using the new authzv1 API
	newBatchCheckReq := func(subject string, items []*authzv1.BatchCheckItem) *authzv1.BatchCheckRequest {
		return &authzv1.BatchCheckRequest{
			Subject: subject,
			Checks:  items,
		}
	}

	// Helper to create batch items for resources in folders
	createBatchItems := func(resources []string, resourceFolders map[string]string) []*authzv1.BatchCheckItem {
		items := make([]*authzv1.BatchCheckItem, 0, batchCheckSize)
		for i := 0; i < batchCheckSize && i < len(resources); i++ {
			resource := resources[i]
			items = append(items, &authzv1.BatchCheckItem{
				Namespace:     benchNamespace,
				Verb:          utils.VerbGet,
				Group:         benchDashboardGroup,
				Resource:      benchDashboardResource,
				Name:          resource,
				Folder:        resourceFolders[resource],
				CorrelationId: fmt.Sprintf("item-%d", i),
			})
		}
		return items
	}

	// Helper to create batch items for folders at a specific depth
	createFolderBatchItems := func(folders []string, depth int, folderDepths map[string]int) []*authzv1.BatchCheckItem {
		items := make([]*authzv1.BatchCheckItem, 0, batchCheckSize)
		for _, folder := range folders {
			if folderDepths[folder] == depth && len(items) < batchCheckSize {
				items = append(items, &authzv1.BatchCheckItem{
					Namespace:     benchNamespace,
					Verb:          utils.VerbGet,
					Group:         benchDashboardGroup,
					Resource:      benchDashboardResource,
					Name:          fmt.Sprintf("resource-in-%s", folder),
					Folder:        folder,
					CorrelationId: fmt.Sprintf("item-%d", len(items)),
				})
			}
		}
		// Fill remaining slots if needed
		for len(items) < batchCheckSize && len(folders) > 0 {
			folder := folders[len(items)%len(folders)]
			items = append(items, &authzv1.BatchCheckItem{
				Namespace:     benchNamespace,
				Verb:          utils.VerbGet,
				Group:         benchDashboardGroup,
				Resource:      benchDashboardResource,
				Name:          fmt.Sprintf("resource-%d", len(items)),
				Folder:        folder,
				CorrelationId: fmt.Sprintf("item-%d", len(items)),
			})
		}
		return items
	}

	usersPerPattern := len(data.users) / numPermissionPatterns

	b.Run("GroupResourceDirect", func(b *testing.B) {
		// User with group_resource permission - should have access to everything
		user := data.users[0]
		items := createBatchItems(data.resources, data.resourceFolders)
		b.Logf("Testing BatchCheck with %d items, user has group_resource permission (all access)", len(items))

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			res, err := srv.BatchCheck(ctx, newBatchCheckReq(user, items))
			if err != nil {
				b.Fatal(err)
			}
			_ = res.Results
		}
	})

	b.Run("FolderInheritance/Depth1", func(b *testing.B) {
		// User with folder permission on shallow folder
		user := data.users[usersPerPattern]
		items := createFolderBatchItems(data.folders, 1, data.folderDepths)
		b.Logf("Testing BatchCheck with %d items at depth 1", len(items))

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			res, err := srv.BatchCheck(ctx, newBatchCheckReq(user, items))
			if err != nil {
				b.Fatal(err)
			}
			_ = res.Results
		}
	})

	b.Run("FolderInheritance/Depth4", func(b *testing.B) {
		// User with folder permission on mid-depth folder
		user := data.users[2*usersPerPattern]
		items := createFolderBatchItems(data.folders, 4, data.folderDepths)
		b.Logf("Testing BatchCheck with %d items at depth 4", len(items))

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			res, err := srv.BatchCheck(ctx, newBatchCheckReq(user, items))
			if err != nil {
				b.Fatal(err)
			}
			_ = res.Results
		}
	})

	b.Run("DirectResource", func(b *testing.B) {
		// User with direct resource permission
		user := data.users[4*usersPerPattern]
		items := createBatchItems(data.resources, data.resourceFolders)
		b.Logf("Testing BatchCheck with %d items, user has direct resource permission", len(items))

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			res, err := srv.BatchCheck(ctx, newBatchCheckReq(user, items))
			if err != nil {
				b.Fatal(err)
			}
			_ = res.Results
		}
	})

	b.Run("NoAccess", func(b *testing.B) {
		// User with no permissions - tests denial path
		user := data.users[len(data.users)-1]
		items := createBatchItems(data.resources, data.resourceFolders)
		b.Logf("Testing BatchCheck with %d items, user has NO permissions (denial case)", len(items))

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			res, err := srv.BatchCheck(ctx, newBatchCheckReq(user, items))
			if err != nil {
				b.Fatal(err)
			}
			_ = res.Results
		}
	})

	b.Run("MixedAccess", func(b *testing.B) {
		// Create items from different folders - user has access to some but not all
		user := data.users[3*usersPerPattern] // folder-scoped resource permission
		items := make([]*authzv1.BatchCheckItem, 0, batchCheckSize)

		// Mix of accessible and inaccessible resources
		for i := 0; i < batchCheckSize; i++ {
			folder := data.folders[i%len(data.folders)]
			items = append(items, &authzv1.BatchCheckItem{
				Namespace:     benchNamespace,
				Verb:          utils.VerbGet,
				Group:         benchDashboardGroup,
				Resource:      benchDashboardResource,
				Name:          fmt.Sprintf("resource-%d", i),
				Folder:        folder,
				CorrelationId: fmt.Sprintf("item-%d", i),
			})
		}
		b.Logf("Testing BatchCheck with %d items, user has mixed access (some allowed, some denied)", len(items))

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			res, err := srv.BatchCheck(ctx, newBatchCheckReq(user, items))
			if err != nil {
				b.Fatal(err)
			}
			_ = res.Results
		}
	})

	// Test BatchCheck at various folder depths
	for depth := 0; depth <= data.maxDepth; depth++ {
		depth := depth // capture for closure
		if len(data.foldersByDepth[depth]) == 0 {
			continue
		}
		b.Run(fmt.Sprintf("ByDepth/Depth%d", depth), func(b *testing.B) {
			user := fmt.Sprintf("user:depth-%d-access", depth)
			items := createFolderBatchItems(data.folders, depth, data.folderDepths)
			b.Logf("Testing BatchCheck with %d items at depth %d", len(items), depth)

			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				res, err := srv.BatchCheck(ctx, newBatchCheckReq(user, items))
				if err != nil {
					b.Fatal(err)
				}
				_ = res.Results
			}
		})
	}
}

// BenchmarkList measures the performance of List requests (Compile equivalent)
func BenchmarkList(b *testing.B) {
	srv, data := setupBenchmarkServer(b)
	baseCtx := newContextWithNamespace()

	// Helper to create list requests
	newListReq := func(subject, verb, group, resource string) *authzv1.ListRequest {
		return &authzv1.ListRequest{
			Namespace: benchNamespace,
			Subject:   subject,
			Verb:      verb,
			Group:     group,
			Resource:  resource,
		}
	}

	// Helper to create context with timeout
	ctxWithTimeout := func() (context.Context, context.CancelFunc) {
		return context.WithTimeout(baseCtx, listTimeout)
	}

	usersPerPattern := len(data.users) / 7

	b.Run("AllAccess", func(b *testing.B) {
		// User with group_resource permission - should return All=true quickly
		user := data.users[0]
		b.Logf("Test: User with group_resource permission (access to ALL dashboards)")
		b.Logf("Expected: All=true returned immediately without ListObjects call")

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			ctx, cancel := ctxWithTimeout()
			res, err := srv.List(ctx, newListReq(user, utils.VerbGet, benchDashboardGroup, benchDashboardResource))
			cancel()
			if err != nil {
				b.Fatalf("Error: %v", err)
			}
			if !res.GetAll() {
				b.Fatal("expected All=true for user with group_resource permission")
			}
		}
	})

	b.Run("FolderScoped", func(b *testing.B) {
		// User with folder permissions - should return folder list
		user := data.users[usersPerPattern]
		b.Logf("Test: User with direct folder permission on a single folder")
		b.Logf("Expected: Returns list of folders user has access to")

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			ctx, cancel := ctxWithTimeout()
			res, err := srv.List(ctx, newListReq(user, utils.VerbGet, benchDashboardGroup, benchDashboardResource))
			cancel()
			if err != nil {
				b.Fatalf("Error: %v", err)
			}
			if i == 0 {
				b.Logf("Result: %d folders, %d items, All=%v", len(res.GetFolders()), len(res.GetItems()), res.GetAll())
			}
		}
	})

	b.Run("DirectResources", func(b *testing.B) {
		// User with direct resource permissions - should return items list
		user := data.users[4*usersPerPattern]
		b.Logf("Test: User with direct permission on specific resources")
		b.Logf("Expected: Returns list of specific resources user has access to")

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			ctx, cancel := ctxWithTimeout()
			res, err := srv.List(ctx, newListReq(user, utils.VerbGet, benchDashboardGroup, benchDashboardResource))
			cancel()
			if err != nil {
				b.Fatalf("Error: %v", err)
			}
			if i == 0 {
				b.Logf("Result: %d folders, %d items, All=%v", len(res.GetFolders()), len(res.GetItems()), res.GetAll())
			}
		}
	})

	b.Run("NoAccess", func(b *testing.B) {
		// User with no permissions - should return empty results
		user := data.users[len(data.users)-1]
		b.Logf("Test: User with NO permissions (denial case)")
		b.Logf("Expected: Empty results")

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			ctx, cancel := ctxWithTimeout()
			res, err := srv.List(ctx, newListReq(user, utils.VerbGet, benchDashboardGroup, benchDashboardResource))
			cancel()
			if err != nil {
				b.Fatalf("Error: %v", err)
			}
			if i == 0 {
				b.Logf("Result: %d folders, %d items, All=%v", len(res.GetFolders()), len(res.GetItems()), res.GetAll())
			}
		}
	})

	b.Run("LargeRootFolder", func(b *testing.B) {
		// User with access to root folder that has many descendants
		user := "user:large-root-access"
		b.Logf("Test: User with permission on ROOT folder (folder-0)")
		b.Logf("Root folder %s has %d total descendants", data.largestRootFolder, data.largestRootDescCount)
		b.Logf("Expected: ListObjects should return folders through inheritance")

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			ctx, cancel := ctxWithTimeout()
			start := time.Now()
			res, err := srv.List(ctx, newListReq(user, utils.VerbGet, benchFolderGroup, benchFolderResource))
			elapsed := time.Since(start)
			cancel()
			if err != nil {
				b.Fatalf("Error after %v: %v", elapsed, err)
			}
			if i == 0 {
				b.Logf("Result: %d folders returned in %v (descendants: %d)",
					len(res.GetItems()), elapsed, data.largestRootDescCount)
			}
		}
	})

	// Test List at various folder depths to find breaking point
	b.Run("ByDepth", func(b *testing.B) {
		b.Logf("Testing List performance at various folder depths (timeout: %v)", listTimeout)
		b.Logf("Tree structure: %d folders per level, %d max depth", foldersPerLevel, data.maxDepth)

		for depth := 0; depth <= data.maxDepth; depth++ {
			if len(data.foldersByDepth[depth]) == 0 {
				continue
			}

			folder := data.foldersByDepth[depth][0]
			descendants := data.folderDescendants[folder]
			user := fmt.Sprintf("user:depth-%d-access", depth)

			b.Run(fmt.Sprintf("Depth%d_%dDescendants", depth, descendants), func(b *testing.B) {
				b.Logf("Test: User with permission on folder at depth %d", depth)
				b.Logf("Folder: %s, Descendants: %d", folder, descendants)

				// First, do a single timed run to report
				ctx, cancel := ctxWithTimeout()
				start := time.Now()
				res, err := srv.List(ctx, newListReq(user, utils.VerbGet, benchFolderGroup, benchFolderResource))
				elapsed := time.Since(start)
				cancel()

				if err != nil {
					b.Logf("FAILED after %v: %v", elapsed, err)
					if elapsed >= listTimeout {
						b.Logf("TIMEOUT: List took longer than %v", listTimeout)
					}
					b.Skip("Skipping benchmark iterations due to error")
					return
				}

				b.Logf("Result: %d folders in %v", len(res.GetItems()), elapsed)

				if elapsed > 5*time.Second {
					b.Logf("WARNING: Single List took %v, skipping benchmark iterations", elapsed)
					b.Skip("Too slow for benchmark iterations")
					return
				}

				b.ResetTimer()
				for i := 0; i < b.N; i++ {
					ctx, cancel := ctxWithTimeout()
					_, err := srv.List(ctx, newListReq(user, utils.VerbGet, benchFolderGroup, benchFolderResource))
					cancel()
					if err != nil {
						b.Fatalf("Error: %v", err)
					}
				}
			})
		}
	})
}
