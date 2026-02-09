package migrations

import (
	"fmt"
	"sort"

	"github.com/google/uuid"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/util/xorm"
)

// resourceHistoryDriftFixMigration inserts missing delete records in resource_history
// for objects whose latest history entry is not a delete (action != 3) but which no
// longer exist in the resource table. This fixes a drift condition that can occur
// during data migration into unified storage.
//
// The migration processes each (group, resource) pair independently and uses a
// windowed scan to find available resource_version slots, avoiding loading all
// used RVs into memory at once.
type resourceHistoryDriftFixMigration struct {
	migrator.MigrationBase
}

func (m *resourceHistoryDriftFixMigration) SQL(_ migrator.Dialect) string {
	return "Insert missing delete records in resource_history for orphaned resources"
}

// driftRow represents a resource_history entry whose latest version is not a delete
// but whose GUID no longer exists in the resource table.
type driftRow struct {
	GUID            string  `xorm:"guid"`
	ResourceVersion int64   `xorm:"resource_version"`
	Group           string  `xorm:"group"`
	Resource        string  `xorm:"resource"`
	Namespace       string  `xorm:"namespace"`
	Name            string  `xorm:"name"`
	Value           *string `xorm:"value"`
	LabelSet        *string `xorm:"label_set"`
	Folder          string  `xorm:"folder"`
	Generation      int64   `xorm:"generation"`
}

type driftGroupResourceKey struct {
	Group    string `xorm:"group"`
	Resource string `xorm:"resource"`
}

// driftRVResult is a helper struct for scanning resource_version values.
type driftRVResult struct {
	ResourceVersion int64 `xorm:"resource_version"`
}

const rvBatchSize = 100

func (m *resourceHistoryDriftFixMigration) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	logger := log.New("resource-history-drift-fix")

	// Step 1: Aggregate — find distinct (group, resource) pairs with drift
	pairs, err := getDriftGroupResourcePairs(sess, mg)
	if err != nil {
		return fmt.Errorf("getting drift group/resource pairs: %w", err)
	}

	logger.Info("found group/resource pairs with drift", "count", len(pairs))
	if len(pairs) == 0 {
		return nil
	}

	// Step 2: Fix each (group, resource) pair independently
	for _, pair := range pairs {
		count, err := fixDriftForGroupResource(sess, mg, pair.Group, pair.Resource)
		if err != nil {
			return fmt.Errorf("fixing drift for group=%s resource=%s: %w", pair.Group, pair.Resource, err)
		}
		if count > 0 {
			logger.Info("inserted drift delete records",
				"group", pair.Group,
				"resource", pair.Resource,
				"count", count,
			)
		}
	}

	return nil
}

// getDriftGroupResourcePairs returns distinct (group, resource) pairs that have
// at least one drift row (latest history is not a delete, but resource is gone).
func getDriftGroupResourcePairs(sess *xorm.Session, mg *migrator.Migrator) ([]driftGroupResourceKey, error) {
	quoteFn := mg.Dialect.Quote
	query := fmt.Sprintf(`
		SELECT DISTINCT rh.%s, rh.resource
		FROM resource_history rh
		INNER JOIN (
			SELECT %s, resource, namespace, name, MAX(resource_version) AS max_version
			FROM resource_history
			GROUP BY %s, resource, namespace, name
		) latest
			ON rh.%s = latest.%s
			AND rh.resource = latest.resource
			AND rh.namespace = latest.namespace
			AND rh.name = latest.name
			AND rh.resource_version = latest.max_version
		WHERE rh.action != 3
		AND NOT EXISTS (SELECT 1 FROM resource r WHERE r.guid = rh.guid)
	`, quoteFn("group"), quoteFn("group"), quoteFn("group"), quoteFn("group"), quoteFn("group"))

	var pairs []driftGroupResourceKey
	if err := sess.SQL(query).Find(&pairs); err != nil {
		return nil, err
	}
	return pairs, nil
}

// fixDriftForGroupResource fetches drift rows for a specific (group, resource) pair,
// finds available resource_version slots using windowed scanning, and inserts
// synthetic delete records. Returns the number of records inserted.
func fixDriftForGroupResource(sess *xorm.Session, mg *migrator.Migrator, group, resource string) (int, error) {
	rows, err := getDriftRowsForGroupResource(sess, mg, group, resource)
	if err != nil {
		return 0, fmt.Errorf("getting drift rows: %w", err)
	}
	if len(rows) == 0 {
		return 0, nil
	}

	// Sort deterministically: by RV ascending, then namespace, name, guid
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].ResourceVersion == rows[j].ResourceVersion {
			if rows[i].Namespace == rows[j].Namespace {
				if rows[i].Name == rows[j].Name {
					return rows[i].GUID < rows[j].GUID
				}
				return rows[i].Name < rows[j].Name
			}
			return rows[i].Namespace < rows[j].Namespace
		}
		return rows[i].ResourceVersion < rows[j].ResourceVersion
	})

	upperBound, err := getDriftRVUpperBound(sess, mg, group, resource)
	if err != nil {
		return 0, fmt.Errorf("getting RV upper bound: %w", err)
	}

	// All new RVs will be greater than the highest drift row's RV, which guarantees
	// each new RV > its corresponding drift row's RV (since we sorted ascending).
	maxDriftRV := rows[len(rows)-1].ResourceVersion
	driftIdx := 0
	scanFrom := maxDriftRV

	// Windowed scan: fetch small batches of used RVs and assign drift rows to gaps.
	for driftIdx < len(rows) {
		usedBatch, err := fetchUsedRVBatch(sess, mg, group, resource, scanFrom, upperBound)
		if err != nil {
			return driftIdx, fmt.Errorf("fetching used RV batch from %d: %w", scanFrom, err)
		}

		// Walk through the batch and fill gaps between consecutive used RVs.
		prev := scanFrom
		for _, usedRV := range usedBatch {
			// Gap: [prev+1, usedRV-1] — all candidates in this range are available.
			for candidate := prev + 1; candidate < usedRV && driftIdx < len(rows); candidate++ {
				if err := insertDriftDeleteRecord(sess, mg, rows[driftIdx], candidate); err != nil {
					return driftIdx, err
				}
				driftIdx++
			}
			prev = usedRV
		}

		if len(usedBatch) < rvBatchSize {
			// No more used RVs beyond this point. Use remaining space: [prev+1, upperBound).
			for candidate := prev + 1; candidate < upperBound && driftIdx < len(rows); candidate++ {
				if err := insertDriftDeleteRecord(sess, mg, rows[driftIdx], candidate); err != nil {
					return driftIdx, err
				}
				driftIdx++
			}
			break
		}

		scanFrom = usedBatch[len(usedBatch)-1]
	}

	if driftIdx < len(rows) {
		return driftIdx, fmt.Errorf("ran out of available resource_versions: assigned %d of %d", driftIdx, len(rows))
	}

	return len(rows), nil
}

// getDriftRowsForGroupResource returns drift rows scoped to a specific (group, resource) pair.
func getDriftRowsForGroupResource(sess *xorm.Session, mg *migrator.Migrator, group, resource string) ([]driftRow, error) {
	quoteFn := mg.Dialect.Quote
	query := fmt.Sprintf(`
		SELECT rh.guid, rh.resource_version, rh.%s, rh.resource, rh.namespace, rh.name,
			rh.value, rh.label_set, rh.folder, rh.generation
		FROM resource_history rh
		INNER JOIN (
			SELECT namespace, name, MAX(resource_version) AS max_version
			FROM resource_history
			WHERE %s = '%s' AND resource = '%s'
			GROUP BY namespace, name
		) latest
			ON rh.namespace = latest.namespace
			AND rh.name = latest.name
			AND rh.resource_version = latest.max_version
		WHERE rh.%s = '%s' AND rh.resource = '%s'
		AND rh.action != 3
		AND NOT EXISTS (SELECT 1 FROM resource r WHERE r.guid = rh.guid)
	`, quoteFn("group"), quoteFn("group"), group, resource, quoteFn("group"), group, resource)

	var rows []driftRow
	if err := sess.SQL(query).Find(&rows); err != nil {
		return nil, err
	}
	return rows, nil
}

// getDriftRVUpperBound returns the current resource_version for a (group, resource) pair
// from the resource_version table.
func getDriftRVUpperBound(sess *xorm.Session, mg *migrator.Migrator, group, resource string) (int64, error) {
	quoteFn := mg.Dialect.Quote
	query := fmt.Sprintf(`
		SELECT resource_version
		FROM resource_version
		WHERE %s = '%s' AND resource = '%s'
	`, quoteFn("group"), group, resource)

	var results []driftRVResult
	if err := sess.SQL(query).Find(&results); err != nil {
		return 0, err
	}
	if len(results) == 0 {
		return 0, fmt.Errorf("no resource_version found for group=%s resource=%s", group, resource)
	}
	return results[0].ResourceVersion, nil
}

// fetchUsedRVBatch returns the next batch of used resource_versions above afterRV
// and below upperBound, ordered ascending. The batch size is capped at rvBatchSize
// to limit memory usage.
func fetchUsedRVBatch(sess *xorm.Session, mg *migrator.Migrator, group, resource string, afterRV, upperBound int64) ([]int64, error) {
	quoteFn := mg.Dialect.Quote
	query := fmt.Sprintf(`
		SELECT resource_version FROM (
			SELECT resource_version
			FROM resource_history
			WHERE %s = '%s' AND resource = '%s' AND resource_version > %d AND resource_version < %d
			UNION
			SELECT resource_version
			FROM resource
			WHERE %s = '%s' AND resource = '%s' AND resource_version > %d AND resource_version < %d
		) AS t
		ORDER BY resource_version ASC
		LIMIT %d
	`, quoteFn("group"), group, resource, afterRV, upperBound,
		quoteFn("group"), group, resource, afterRV, upperBound,
		rvBatchSize)

	var results []driftRVResult
	if err := sess.SQL(query).Find(&results); err != nil {
		return nil, err
	}

	rvs := make([]int64, len(results))
	for i, r := range results {
		rvs[i] = r.ResourceVersion
	}
	return rvs, nil
}

// insertDriftDeleteRecord inserts a synthetic delete record (action=3) into resource_history
// with a new GUID, the given resource_version, and a properly formed key_path.
func insertDriftDeleteRecord(sess *xorm.Session, mg *migrator.Migrator, row driftRow, resourceVersion int64) error {
	quoteFn := mg.Dialect.Quote
	keyPath := fmt.Sprintf("unified/data/%s/%s/%s/%s/%d~deleted~%s",
		row.Group, row.Resource, row.Namespace, row.Name,
		snowflakeFromRv(resourceVersion), row.Folder,
	)

	query := fmt.Sprintf(`
		INSERT INTO resource_history
			(guid, resource_version, %s, resource, namespace, name, value, action, label_set, previous_resource_version, folder, generation, key_path)
		VALUES
			(?, ?, ?, ?, ?, ?, ?, 3, ?, ?, ?, 0, ?)
	`, quoteFn("group"))

	_, err := sess.Exec(query,
		uuid.New().String(),
		resourceVersion,
		row.Group,
		row.Resource,
		row.Namespace,
		row.Name,
		row.Value,           // *string: nil becomes NULL
		row.LabelSet,        // *string: nil becomes NULL
		row.ResourceVersion, // previous_resource_version
		row.Folder,
		keyPath,
	)
	return err
}
