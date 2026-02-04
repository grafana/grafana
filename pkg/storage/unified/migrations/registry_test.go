package migrations

import (
	"context"
	"sync"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/xorm"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// Test helper to create a simple MigrationDefinition for testing
func testMigrationDefinition(id string, resources ...ResourceInfo) MigrationDefinition {
	return MigrationDefinition{
		ID:          id,
		MigrationID: id + " migration",
		Resources:   resources,
		Migrators:   make(map[schema.GroupResource]MigratorFactory),
	}
}

// Test helper to create a GroupResource
func testGroupResource(group, resource string) schema.GroupResource {
	return schema.GroupResource{Group: group, Resource: resource}
}

// Test helper to create a ResourceInfo
func testResourceInfo(group, resource, lockTable string) ResourceInfo {
	return ResourceInfo{
		GroupResource: schema.GroupResource{Group: group, Resource: resource},
		LockTable:     lockTable,
	}
}

func TestNewMigrationRegistry(t *testing.T) {
	t.Run("creates empty registry with initialized maps", func(t *testing.T) {
		r := NewMigrationRegistry()

		require.NotNil(t, r)
		require.NotNil(t, r.definitions)
		require.NotNil(t, r.order)
		require.Empty(t, r.definitions)
		require.Empty(t, r.order)
	})
}

func TestMigrationRegistry_Register(t *testing.T) {
	t.Run("registers single definition", func(t *testing.T) {
		r := NewMigrationRegistry()
		def := testMigrationDefinition("test-1", testResourceInfo("group1", "resource1", "table1"))

		r.Register(def)

		require.Len(t, r.definitions, 1)
		require.Len(t, r.order, 1)
		require.Equal(t, "test-1", r.order[0])
		stored, ok := r.definitions["test-1"]
		require.True(t, ok)
		require.Equal(t, def.ID, stored.ID)
	})

	t.Run("registers multiple definitions", func(t *testing.T) {
		r := NewMigrationRegistry()
		def1 := testMigrationDefinition("test-1", testResourceInfo("group1", "resource1", "table1"))
		def2 := testMigrationDefinition("test-2", testResourceInfo("group2", "resource2", "table2"))
		def3 := testMigrationDefinition("test-3", testResourceInfo("group3", "resource3", "table3"))

		r.Register(def1)
		r.Register(def2)
		r.Register(def3)

		require.Len(t, r.definitions, 3)
		require.Len(t, r.order, 3)
	})

	t.Run("preserves insertion order", func(t *testing.T) {
		r := NewMigrationRegistry()

		r.Register(testMigrationDefinition("alpha"))
		r.Register(testMigrationDefinition("beta"))
		r.Register(testMigrationDefinition("gamma"))
		r.Register(testMigrationDefinition("delta"))

		require.Equal(t, []string{"alpha", "beta", "gamma", "delta"}, r.order)
	})

	t.Run("stores definition with all fields", func(t *testing.T) {
		r := NewMigrationRegistry()
		gr := testGroupResource("test.grafana.app", "widgets")
		ri := ResourceInfo{GroupResource: gr, LockTable: "widgets"}
		def := MigrationDefinition{
			ID:          "widgets-migration",
			MigrationID: "widgets migration log id",
			Resources:   []ResourceInfo{ri},
			Migrators: map[schema.GroupResource]MigratorFactory{
				gr: func(a legacy.MigrationDashboardAccessor) MigratorFunc {
					return nil
				},
			},
		}

		r.Register(def)

		stored, ok := r.Get("widgets-migration")
		require.True(t, ok)
		require.Equal(t, "widgets-migration", stored.ID)
		require.Equal(t, "widgets migration log id", stored.MigrationID)
		require.Len(t, stored.Resources, 1)
		require.Equal(t, ri, stored.Resources[0])
	})
}

func TestMigrationRegistry_Register_DuplicatePanics(t *testing.T) {
	t.Run("panics on duplicate ID", func(t *testing.T) {
		r := NewMigrationRegistry()
		def := testMigrationDefinition("duplicate-id")

		r.Register(def)

		require.Panics(t, func() {
			r.Register(def)
		}, "registering duplicate ID should panic")
	})

	t.Run("panics with correct message", func(t *testing.T) {
		r := NewMigrationRegistry()
		def := testMigrationDefinition("my-migration")

		r.Register(def)

		defer func() {
			if rec := recover(); rec != nil {
				msg, ok := rec.(string)
				require.True(t, ok, "panic value should be a string")
				require.Contains(t, msg, "my-migration")
				require.Contains(t, msg, "already registered")
			}
		}()

		r.Register(def)
		t.Fatal("expected panic but none occurred")
	})
}

func TestMigrationRegistry_Get(t *testing.T) {
	t.Run("returns definition and true for existing ID", func(t *testing.T) {
		r := NewMigrationRegistry()
		def := testMigrationDefinition("existing", testResourceInfo("g", "r", "table"))
		r.Register(def)

		result, ok := r.Get("existing")

		require.True(t, ok)
		require.Equal(t, def.ID, result.ID)
		require.Equal(t, def.MigrationID, result.MigrationID)
		require.Equal(t, def.Resources, result.Resources)
	})

	t.Run("returns empty definition and false for non-existing ID", func(t *testing.T) {
		r := NewMigrationRegistry()
		r.Register(testMigrationDefinition("other"))

		result, ok := r.Get("non-existing")

		require.False(t, ok)
		require.Equal(t, MigrationDefinition{}, result)
	})

	t.Run("returns false for empty registry", func(t *testing.T) {
		r := NewMigrationRegistry()

		result, ok := r.Get("any-id")

		require.False(t, ok)
		require.Equal(t, MigrationDefinition{}, result)
	})

	t.Run("retrieves correct definition among multiple", func(t *testing.T) {
		r := NewMigrationRegistry()
		r.Register(testMigrationDefinition("first", testResourceInfo("g1", "r1", "t1")))
		r.Register(testMigrationDefinition("second", testResourceInfo("g2", "r2", "t2")))
		r.Register(testMigrationDefinition("third", testResourceInfo("g3", "r3", "t3")))

		result, ok := r.Get("second")

		require.True(t, ok)
		require.Equal(t, "second", result.ID)
		require.Equal(t, testResourceInfo("g2", "r2", "t2"), result.Resources[0])
	})
}

func TestMigrationRegistry_All(t *testing.T) {
	t.Run("returns empty slice for empty registry", func(t *testing.T) {
		r := NewMigrationRegistry()

		result := r.All()

		require.NotNil(t, result)
		require.Empty(t, result)
	})

	t.Run("returns single definition", func(t *testing.T) {
		r := NewMigrationRegistry()
		def := testMigrationDefinition("single")
		r.Register(def)

		result := r.All()

		require.Len(t, result, 1)
		require.Equal(t, "single", result[0].ID)
	})

	t.Run("returns all definitions in registration order", func(t *testing.T) {
		r := NewMigrationRegistry()
		r.Register(testMigrationDefinition("first"))
		r.Register(testMigrationDefinition("second"))
		r.Register(testMigrationDefinition("third"))
		r.Register(testMigrationDefinition("fourth"))

		result := r.All()

		require.Len(t, result, 4)
		require.Equal(t, "first", result[0].ID)
		require.Equal(t, "second", result[1].ID)
		require.Equal(t, "third", result[2].ID)
		require.Equal(t, "fourth", result[3].ID)
	})

	t.Run("returns copy of definitions not affecting internal state", func(t *testing.T) {
		r := NewMigrationRegistry()
		r.Register(testMigrationDefinition("original"))

		result := r.All()
		result[0] = testMigrationDefinition("modified")

		// Original should be unchanged
		stored, _ := r.Get("original")
		require.Equal(t, "original", stored.ID)
	})
}

func TestMigrationRegistry_HasResource(t *testing.T) {
	t.Run("returns true when resource exists in single definition", func(t *testing.T) {
		r := NewMigrationRegistry()
		gr := testGroupResource("test.grafana.app", "widgets")
		def := testMigrationDefinition("test")
		def.Migrators[gr] = func(a legacy.MigrationDashboardAccessor) MigratorFunc {
			return nil
		}
		r.Register(def)

		result := r.HasResource(gr)

		require.True(t, result)
	})

	t.Run("returns true when resource exists in one of multiple definitions", func(t *testing.T) {
		r := NewMigrationRegistry()

		gr1 := testGroupResource("group1", "resource1")
		gr2 := testGroupResource("group2", "resource2")
		gr3 := testGroupResource("group3", "resource3")

		def1 := testMigrationDefinition("def1")
		def1.Migrators[gr1] = func(a legacy.MigrationDashboardAccessor) MigratorFunc {
			return nil
		}

		def2 := testMigrationDefinition("def2")
		def2.Migrators[gr2] = func(a legacy.MigrationDashboardAccessor) MigratorFunc {
			return nil
		}
		def2.Migrators[gr3] = func(a legacy.MigrationDashboardAccessor) MigratorFunc {
			return nil
		}

		r.Register(def1)
		r.Register(def2)

		require.True(t, r.HasResource(gr1))
		require.True(t, r.HasResource(gr2))
		require.True(t, r.HasResource(gr3))
	})

	t.Run("returns false when resource does not exist", func(t *testing.T) {
		r := NewMigrationRegistry()
		existingGR := testGroupResource("existing.group", "existing")
		def := testMigrationDefinition("test")
		def.Migrators[existingGR] = func(a legacy.MigrationDashboardAccessor) MigratorFunc {
			return nil
		}
		r.Register(def)

		nonExistingGR := testGroupResource("nonexisting.group", "nonexisting")
		result := r.HasResource(nonExistingGR)

		require.False(t, result)
	})

	t.Run("returns false for empty registry", func(t *testing.T) {
		r := NewMigrationRegistry()

		result := r.HasResource(testGroupResource("any", "resource"))

		require.False(t, result)
	})

	t.Run("distinguishes between group and resource", func(t *testing.T) {
		r := NewMigrationRegistry()
		gr := testGroupResource("my.group", "my-resource")
		def := testMigrationDefinition("test")
		def.Migrators[gr] = func(a legacy.MigrationDashboardAccessor) MigratorFunc {
			return nil
		}
		r.Register(def)

		// Same resource, different group
		require.False(t, r.HasResource(testGroupResource("other.group", "my-resource")))
		// Same group, different resource
		require.False(t, r.HasResource(testGroupResource("my.group", "other-resource")))
		// Exact match
		require.True(t, r.HasResource(testGroupResource("my.group", "my-resource")))
	})
}

func TestMigrationDefinition_ConfigResources(t *testing.T) {
	t.Run("formats single resource correctly", func(t *testing.T) {
		def := MigrationDefinition{
			Resources: []ResourceInfo{
				{GroupResource: schema.GroupResource{Group: "dashboard.grafana.app", Resource: "dashboards"}, LockTable: "dashboard"},
			},
		}

		result := def.ConfigResources()

		require.Len(t, result, 1)
		require.Equal(t, "dashboards.dashboard.grafana.app", result[0])
	})

	t.Run("formats multiple resources correctly", func(t *testing.T) {
		def := MigrationDefinition{
			Resources: []ResourceInfo{
				{GroupResource: schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}, LockTable: "folder"},
				{GroupResource: schema.GroupResource{Group: "dashboard.grafana.app", Resource: "dashboards"}, LockTable: "dashboard"},
				{GroupResource: schema.GroupResource{Group: "playlist.grafana.app", Resource: "playlists"}, LockTable: "playlist"},
			},
		}

		result := def.ConfigResources()

		require.Len(t, result, 3)
		require.Equal(t, "folders.folder.grafana.app", result[0])
		require.Equal(t, "dashboards.dashboard.grafana.app", result[1])
		require.Equal(t, "playlists.playlist.grafana.app", result[2])
	})

	t.Run("returns empty slice for no resources", func(t *testing.T) {
		def := MigrationDefinition{
			Resources: []ResourceInfo{},
		}

		result := def.ConfigResources()

		require.NotNil(t, result)
		require.Empty(t, result)
	})

	t.Run("handles empty group", func(t *testing.T) {
		def := MigrationDefinition{
			Resources: []ResourceInfo{
				{GroupResource: schema.GroupResource{Group: "", Resource: "configmaps"}, LockTable: "configmaps"},
			},
		}

		result := def.ConfigResources()

		require.Len(t, result, 1)
		require.Equal(t, "configmaps.", result[0])
	})

	t.Run("handles empty resource", func(t *testing.T) {
		def := MigrationDefinition{
			Resources: []ResourceInfo{
				{GroupResource: schema.GroupResource{Group: "some.group", Resource: ""}, LockTable: ""},
			},
		}

		result := def.ConfigResources()

		require.Len(t, result, 1)
		require.Equal(t, ".some.group", result[0])
	})
}

func TestMigrationDefinition_GetMigratorFunc(t *testing.T) {
	t.Run("returns migrator function for existing resource", func(t *testing.T) {
		gr := testGroupResource("test.group", "widgets")
		called := false
		def := MigrationDefinition{
			Migrators: map[schema.GroupResource]MigratorFactory{
				gr: func(a legacy.MigrationDashboardAccessor) MigratorFunc {
					return func(ctx context.Context, orgId int64, opts legacy.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error {
						called = true
						return nil
					}
				},
			},
		}

		// Pass nil accessor since our mock doesn't use it
		result := def.GetMigratorFunc(nil, gr)

		require.NotNil(t, result)
		// Verify the function is actually callable
		err := result(context.Background(), 1, legacy.MigrateOptions{}, nil)
		require.NoError(t, err)
		require.True(t, called)
	})

	t.Run("returns nil for non-existing resource", func(t *testing.T) {
		existingGR := testGroupResource("existing.group", "widgets")
		def := MigrationDefinition{
			Migrators: map[schema.GroupResource]MigratorFactory{
				existingGR: func(a legacy.MigrationDashboardAccessor) MigratorFunc {
					return nil
				},
			},
		}

		nonExistingGR := testGroupResource("other.group", "gadgets")
		result := def.GetMigratorFunc(nil, nonExistingGR)

		require.Nil(t, result)
	})

	t.Run("returns nil for empty migrators map", func(t *testing.T) {
		def := MigrationDefinition{
			Migrators: make(map[schema.GroupResource]MigratorFactory),
		}

		result := def.GetMigratorFunc(nil, testGroupResource("any", "resource"))

		require.Nil(t, result)
	})
}

func TestMigrationDefinition_CreateValidators(t *testing.T) {
	t.Run("creates validators from factories", func(t *testing.T) {
		factory1Called := false
		factory2Called := false

		def := MigrationDefinition{
			Validators: []ValidatorFactory{
				func(client resourcepb.ResourceIndexClient, driverName string) Validator {
					factory1Called = true
					return &mockValidator{name: "validator1"}
				},
				func(client resourcepb.ResourceIndexClient, driverName string) Validator {
					factory2Called = true
					return &mockValidator{name: "validator2"}
				},
			},
		}

		result := def.CreateValidators(nil, "sqlite3")

		require.Len(t, result, 2)
		require.True(t, factory1Called)
		require.True(t, factory2Called)
		require.Equal(t, "validator1", result[0].Name())
		require.Equal(t, "validator2", result[1].Name())
	})

	t.Run("passes client and driver name to factory", func(t *testing.T) {
		var capturedDriverName string

		def := MigrationDefinition{
			Validators: []ValidatorFactory{
				func(client resourcepb.ResourceIndexClient, driverName string) Validator {
					capturedDriverName = driverName
					return &mockValidator{}
				},
			},
		}

		def.CreateValidators(nil, "postgres")

		require.Equal(t, "postgres", capturedDriverName)
	})

	t.Run("returns empty slice for no validators", func(t *testing.T) {
		def := MigrationDefinition{
			Validators: []ValidatorFactory{},
		}

		result := def.CreateValidators(nil, "mysql")

		require.NotNil(t, result)
		require.Empty(t, result)
	})

	t.Run("returns empty slice for nil validators", func(t *testing.T) {
		def := MigrationDefinition{
			Validators: nil,
		}

		result := def.CreateValidators(nil, "mysql")

		require.NotNil(t, result)
		require.Empty(t, result)
	})
}

func TestMigrationRegistry_GetMigratorFunc(t *testing.T) {
	t.Run("finds migrator in first definition", func(t *testing.T) {
		r := NewMigrationRegistry()

		gr := testGroupResource("first.group", "resource")
		def := testMigrationDefinition("first")
		def.Migrators[gr] = func(a legacy.MigrationDashboardAccessor) MigratorFunc {
			return func(ctx context.Context, orgId int64, opts legacy.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error {
				return nil
			}
		}
		r.Register(def)

		result := r.GetMigratorFunc(nil, gr)

		require.NotNil(t, result)
	})

	t.Run("finds migrator in second definition", func(t *testing.T) {
		r := NewMigrationRegistry()

		gr1 := testGroupResource("first.group", "resource1")
		def1 := testMigrationDefinition("first")
		def1.Migrators[gr1] = func(a legacy.MigrationDashboardAccessor) MigratorFunc {
			return func(ctx context.Context, orgId int64, opts legacy.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error {
				return nil
			}
		}

		gr2 := testGroupResource("second.group", "resource2")
		def2 := testMigrationDefinition("second")
		def2.Migrators[gr2] = func(a legacy.MigrationDashboardAccessor) MigratorFunc {
			return func(ctx context.Context, orgId int64, opts legacy.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error {
				return nil
			}
		}

		r.Register(def1)
		r.Register(def2)

		result := r.GetMigratorFunc(nil, gr2)

		require.NotNil(t, result)
	})

	t.Run("returns nil when not found in any definition", func(t *testing.T) {
		r := NewMigrationRegistry()

		gr := testGroupResource("existing.group", "resource")
		def := testMigrationDefinition("test")
		def.Migrators[gr] = func(a legacy.MigrationDashboardAccessor) MigratorFunc {
			return func(ctx context.Context, orgId int64, opts legacy.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error {
				return nil
			}
		}
		r.Register(def)

		nonExisting := testGroupResource("nonexisting.group", "other")
		result := r.GetMigratorFunc(nil, nonExisting)

		require.Nil(t, result)
	})

	t.Run("returns nil for empty registry", func(t *testing.T) {
		r := NewMigrationRegistry()

		result := r.GetMigratorFunc(nil, testGroupResource("any", "resource"))

		require.Nil(t, result)
	})
}

func TestMigrationRegistry_ConcurrentAccess(t *testing.T) {
	t.Run("concurrent register and get operations", func(t *testing.T) {
		r := NewMigrationRegistry()
		var wg sync.WaitGroup
		numGoroutines := 100

		// Pre-register some definitions to avoid panic from duplicates
		for i := 0; i < numGoroutines; i++ {
			def := testMigrationDefinition("def-" + string(rune('a'+i%26)) + string(rune('0'+i/26)))
			gr := testGroupResource("group", "resource-"+string(rune('a'+i%26))+string(rune('0'+i/26)))
			def.Migrators[gr] = func(a legacy.MigrationDashboardAccessor) MigratorFunc {
				return nil
			}
			r.Register(def)
		}

		// Concurrent reads
		wg.Add(numGoroutines * 3)

		// Goroutines calling Get
		for i := 0; i < numGoroutines; i++ {
			go func(i int) {
				defer wg.Done()
				id := "def-" + string(rune('a'+i%26)) + string(rune('0'+i/26))
				_, _ = r.Get(id)
			}(i)
		}

		// Goroutines calling All
		for i := 0; i < numGoroutines; i++ {
			go func() {
				defer wg.Done()
				_ = r.All()
			}()
		}

		// Goroutines calling HasResource
		for i := 0; i < numGoroutines; i++ {
			go func(i int) {
				defer wg.Done()
				gr := testGroupResource("group", "resource-"+string(rune('a'+i%26))+string(rune('0'+i/26)))
				_ = r.HasResource(gr)
			}(i)
		}

		wg.Wait()
	})

	t.Run("concurrent All calls return consistent data", func(t *testing.T) {
		r := NewMigrationRegistry()

		// Register some definitions
		for i := 0; i < 10; i++ {
			r.Register(testMigrationDefinition("def-" + string(rune('a'+i))))
		}

		var wg sync.WaitGroup
		results := make([][]MigrationDefinition, 50)

		for i := 0; i < 50; i++ {
			wg.Add(1)
			go func(idx int) {
				defer wg.Done()
				results[idx] = r.All()
			}(i)
		}

		wg.Wait()

		// All results should be identical
		expected := results[0]
		for i, result := range results {
			require.Len(t, result, len(expected), "result %d has different length", i)
			for j := range result {
				require.Equal(t, expected[j].ID, result[j].ID, "result %d has different ID at index %d", i, j)
			}
		}
	})

	t.Run("concurrent GetMigratorFunc calls", func(t *testing.T) {
		r := NewMigrationRegistry()

		gr := testGroupResource("test.group", "widgets")
		def := testMigrationDefinition("test")
		def.Migrators[gr] = func(a legacy.MigrationDashboardAccessor) MigratorFunc {
			return func(ctx context.Context, orgId int64, opts legacy.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error {
				return nil
			}
		}
		r.Register(def)

		var wg sync.WaitGroup
		for i := 0; i < 100; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				fn := r.GetMigratorFunc(nil, gr)
				require.NotNil(t, fn)
			}()
		}

		wg.Wait()
	})
}

// mockValidator is a simple test implementation of Validator
type mockValidator struct {
	name string
}

func (m *mockValidator) Name() string {
	return m.name
}

func (m *mockValidator) Validate(ctx context.Context, sess *xorm.Session, response *resourcepb.BulkResponse, logger log.Logger) error {
	return nil
}

func TestGlobalRegistry(t *testing.T) {
	t.Run("global Registry is initialized", func(t *testing.T) {
		require.NotNil(t, Registry)
		require.NotNil(t, Registry.definitions)
		require.NotNil(t, Registry.order)
	})

	t.Run("global Registry contains folders-dashboards migration", func(t *testing.T) {
		def, ok := Registry.Get("folders-dashboards")
		require.True(t, ok)
		require.Equal(t, "folders-dashboards", def.ID)
		require.Equal(t, "folders and dashboards migration", def.MigrationID)
		require.Len(t, def.Resources, 2)
	})

	t.Run("global Registry contains playlists migration", func(t *testing.T) {
		def, ok := Registry.Get("playlists")
		require.True(t, ok)
		require.Equal(t, "playlists", def.ID)
		require.Equal(t, "playlists migration", def.MigrationID)
		require.Len(t, def.Resources, 1)
	})

	t.Run("global Registry All returns definitions in order", func(t *testing.T) {
		all := Registry.All()

		// Find the positions of our known migrations
		foldersIdx := -1
		playlistsIdx := -1
		for i, def := range all {
			if def.ID == "folders-dashboards" {
				foldersIdx = i
			}
			if def.ID == "playlists" {
				playlistsIdx = i
			}
		}

		require.NotEqual(t, -1, foldersIdx, "folders-dashboards should be registered")
		require.NotEqual(t, -1, playlistsIdx, "playlists should be registered")
		// folders-dashboards is registered before playlists in init()
		assert.Less(t, foldersIdx, playlistsIdx, "folders-dashboards should come before playlists")
	})
}
