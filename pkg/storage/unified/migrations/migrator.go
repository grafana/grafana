package migrations

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/dskit/backoff"
	"github.com/grafana/grafana/pkg/infra/log"
	"google.golang.org/grpc/metadata"
	"k8s.io/apimachinery/pkg/runtime/schema"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// MigrateOptions contains configuration for a resource migration operation.
type MigrateOptions struct {
	Namespace   string
	Resources   []schema.GroupResource
	WithHistory bool // only applies to dashboards
	Progress    func(count int, msg string)
}

// MigrationTableLocker abstracts locking of legacy database tables during migration.
type MigrationTableLocker interface {
	// LockMigrationTables locks legacy tables during migration to prevent concurrent updates.
	LockMigrationTables(ctx context.Context, tables []string) (func(context.Context) error, error)
}

// Read from legacy and write into unified storage
//
//go:generate mockery --name UnifiedMigrator --structname MockUnifiedMigrator --inpackage --filename migrator_mock.go --with-expecter
type UnifiedMigrator interface {
	Migrate(ctx context.Context, opts MigrateOptions) (*resourcepb.BulkResponse, error)
	RebuildIndexes(ctx context.Context, opts RebuildIndexOptions) error
}

// unifiedMigration handles the migration of legacy resources to unified storage
type unifiedMigration struct {
	tableLocker    MigrationTableLocker
	streamProvider streamProvider
	client         resource.SearchClient
	log            log.Logger
	registry       *MigrationRegistry
}

// streamProvider abstracts the different ways to create a bulk process stream
type streamProvider interface {
	createStream(ctx context.Context, opts MigrateOptions, registry *MigrationRegistry) (resourcepb.BulkStore_BulkProcessClient, error)
}

func buildCollectionSettings(opts MigrateOptions, registry *MigrationRegistry) resource.BulkSettings {
	settings := resource.BulkSettings{SkipValidation: true}
	for _, res := range opts.Resources {
		key := buildResourceKey(res, opts.Namespace, registry)
		if key != nil {
			settings.Collection = append(settings.Collection, key)
		}
	}
	return settings
}

type resourceClientStreamProvider struct {
	client resource.ResourceClient
}

func (r *resourceClientStreamProvider) createStream(ctx context.Context, opts MigrateOptions, registry *MigrationRegistry) (resourcepb.BulkStore_BulkProcessClient, error) {
	settings := buildCollectionSettings(opts, registry)
	ctx = metadata.NewOutgoingContext(ctx, settings.ToMD())
	return r.client.BulkProcess(ctx)
}

// This can migrate Folders, Dashboards, LibraryPanels and Playlists
func ProvideUnifiedMigrator(
	sql legacysql.LegacyDatabaseProvider,
	client resource.ResourceClient,
	registry *MigrationRegistry,
) UnifiedMigrator {
	return newUnifiedMigrator(
		&legacyTableLocker{sql: sql},
		&resourceClientStreamProvider{client: client},
		client,
		log.New("storage.unified.migrator"),
		registry,
	)
}

func newUnifiedMigrator(
	tableLocker MigrationTableLocker,
	streamProvider streamProvider,
	client resource.SearchClient,
	log log.Logger,
	registry *MigrationRegistry,
) UnifiedMigrator {
	return &unifiedMigration{
		tableLocker:    tableLocker,
		streamProvider: streamProvider,
		client:         client,
		log:            log,
		registry:       registry,
	}
}

func (m *unifiedMigration) Migrate(ctx context.Context, opts MigrateOptions) (*resourcepb.BulkResponse, error) {
	info, err := authlib.ParseNamespace(opts.Namespace)
	if err != nil {
		return nil, err
	}
	if opts.Progress == nil {
		opts.Progress = func(count int, msg string) {} // noop
	}

	if len(opts.Resources) < 1 {
		return nil, fmt.Errorf("missing resource selector")
	}

	lockTables := m.lockTablesForResources(opts.Resources)
	unlockTables, err := m.tableLocker.LockMigrationTables(ctx, lockTables)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := unlockTables(ctx); err != nil {
			m.log.Error("error unlocking legacy tables", "error", err, "namespace", opts.Namespace)
		}
	}()

	stream, err := m.streamProvider.createStream(ctx, opts, m.registry)
	if err != nil {
		return nil, err
	}

	migratorFuncs := []MigratorFunc{}
	for _, res := range opts.Resources {
		fn := m.registry.GetMigratorFunc(res)
		if fn == nil {
			return nil, fmt.Errorf("unsupported resource: %s/%s", res.Group, res.Resource)
		}
		migratorFuncs = append(migratorFuncs, fn)
	}

	// Execute migrations
	m.log.Info("start migrating legacy resources", "namespace", opts.Namespace, "orgId", info.OrgID, "stackId", info.StackID)
	for _, fn := range migratorFuncs {
		err := fn(ctx, info.OrgID, opts, stream)
		if err != nil {
			m.log.Error("error migrating legacy resources", "error", err, "namespace", opts.Namespace)
			return nil, err
		}
	}
	m.log.Info("finished migrating legacy resources", "namespace", opts.Namespace, "orgId", info.OrgID, "stackId", info.StackID)
	return stream.CloseAndRecv()
}

type RebuildIndexOptions struct {
	UsingDistributor    bool
	NamespaceInfo       authlib.NamespaceInfo
	Resources           []schema.GroupResource
	MigrationFinishedAt time.Time
}

func (m *unifiedMigration) RebuildIndexes(ctx context.Context, opts RebuildIndexOptions) error {
	m.log.Info("start rebuilding index for resources", "namespace", opts.NamespaceInfo.Value, "orgId", opts.NamespaceInfo.OrgID, "resources", opts.Resources)
	defer m.log.Info("finished rebuilding index for resources", "namespace", opts.NamespaceInfo.Value, "orgId", opts.NamespaceInfo.OrgID, "resources", opts.Resources)

	boff := backoff.New(ctx, backoff.Config{
		MinBackoff: 500 * time.Millisecond,
		MaxBackoff: 3 * time.Second,
		MaxRetries: 5,
	})

	var lastErr error
	for boff.Ongoing() {
		err := m.rebuildIndexes(ctx, opts)
		if err == nil {
			return nil
		}

		lastErr = err
		m.log.Error("retrying rebuild indexes", "namespace", opts.NamespaceInfo.Value, "orgId", opts.NamespaceInfo.OrgID, "error", err, "attempt", boff.NumRetries())
		boff.Wait()
	}

	if err := boff.ErrCause(); err != nil {
		m.log.Error("failed to rebuild indexes after retries", "namespace", opts.NamespaceInfo.Value, "orgId", opts.NamespaceInfo.OrgID, "error", lastErr)
		return lastErr
	}

	return nil
}

func (m *unifiedMigration) rebuildIndexes(ctx context.Context, opts RebuildIndexOptions) error {
	keys := []*resourcepb.ResourceKey{}
	for _, res := range opts.Resources {
		key := buildResourceKey(res, opts.NamespaceInfo.Value, m.registry)
		if key != nil {
			keys = append(keys, key)
		}
	}

	response, err := m.client.RebuildIndexes(ctx, &resourcepb.RebuildIndexesRequest{
		Namespace: opts.NamespaceInfo.Value,
		Keys:      keys,
	})
	if err != nil {
		return fmt.Errorf("error rebuilding index: %w", err)
	}

	if response.Error != nil {
		m.log.Error("error rebuilding index for resource", "error", response.Error.Message, "namespace", opts.NamespaceInfo.Value, "orgId", opts.NamespaceInfo.OrgID, "resources", opts.Resources)
		return fmt.Errorf("rebuild index error: %s", response.Error.Message)
	}

	if opts.UsingDistributor {
		if !response.ContactedAllInstances {
			m.log.Error("distributor did not contact all instances", "namespace", opts.NamespaceInfo.Value, "orgId", opts.NamespaceInfo.OrgID, "resources", opts.Resources)
			return fmt.Errorf("rebuild index error: distributor did not contact all instances")
		}

		m.log.Info("distributor contacted all instances", "namespace", opts.NamespaceInfo.Value, "orgId", opts.NamespaceInfo.OrgID)

		buildTimeMap := make(map[string]int64)
		for _, bt := range response.BuildTimes {
			key := bt.Group + "/" + bt.Resource
			buildTimeMap[key] = bt.BuildTimeUnix
		}

		migrationFinishTime := opts.MigrationFinishedAt.Unix()

		// Only validate resources that have a build time reported.
		// Resources with no data (and therefore no index) won't have a build time,
		// and that's fine - we skip validation for those.
		for _, res := range opts.Resources {
			key := res.Group + "/" + res.Resource
			buildTime, found := buildTimeMap[key]
			if !found {
				m.log.Info("no build time reported for resource, skipping validation (index may not exist)", "resource", key, "namespace", opts.NamespaceInfo.Value, "orgId", opts.NamespaceInfo.OrgID)
				continue
			}

			if buildTime < migrationFinishTime {
				m.log.Error("index build time is before migration finished", "resource", key, "build_time", time.Unix(buildTime, 0), "migration_finished_at", opts.MigrationFinishedAt, "namespace", opts.NamespaceInfo.Value, "orgId", opts.NamespaceInfo.OrgID)
				return fmt.Errorf("rebuild index error: index for %s was built before migration finished (built at %s, migration finished at %s)", key, time.Unix(buildTime, 0), opts.MigrationFinishedAt)
			}

			m.log.Info("verified index build time", "resource", key, "build_time", time.Unix(buildTime, 0), "migration_finished_at", opts.MigrationFinishedAt, "namespace", opts.NamespaceInfo.Value, "orgId", opts.NamespaceInfo.OrgID)
		}
	}

	return nil
}

func (m *unifiedMigration) lockTablesForResources(resources []schema.GroupResource) []string {
	tables := make([]string, 0, len(resources))
	seen := make(map[string]struct{})
	for _, res := range resources {
		for _, table := range m.registry.GetLockTables(res) {
			if _, ok := seen[table]; ok {
				continue
			}
			seen[table] = struct{}{}
			tables = append(tables, table)
		}
	}
	return tables
}
