package migrations

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/storage/sqlutil"
	migrator "github.com/grafana/grafana/pkg/storage/sqlutil/migrator"
)

// rvFloor is the first microsecond timestamp that produces a 19-digit snowflake ID,
// necessary for proper lexicographic comparison of key_paths in the sqlkv backend.
var rvFloor int64 = time.Date(2018, 5, 25, 13, 5, 53, 759000000, time.UTC).UnixMicro()

const rvFixBatchSize = 100
const rvScanBatchSize = 100

type SmallRVFixMigration struct {
	migrator.MigrationBase
}

func (m *SmallRVFixMigration) SQL(_ migrator.Dialect) string {
	return "fix small resource versions code migration"
}

func (m *SmallRVFixMigration) Exec(ctx context.Context, queryer migrator.Queryer, mg *migrator.Migrator) error {
	quoteFn := mg.Dialect.Quote

	// Step 1: Find all affected group+resource combinations
	affectedGRs, err := getAffectedGroupResources(ctx, queryer, quoteFn)
	if err != nil {
		return fmt.Errorf("finding affected group resources: %w", err)
	}
	if len(affectedGRs) == 0 {
		return nil
	}

	for _, gr := range affectedGRs {
		if err := fixGroupResource(ctx, queryer, quoteFn, mg, gr); err != nil {
			return fmt.Errorf("fixing group=%s resource=%s: %w", gr.group, gr.resource, err)
		}
	}
	return nil
}

type groupResource struct {
	group    string
	resource string
}

type rvUpdateEntry struct {
	guid    string
	oldRV   int64
	newRV   int64
	keyPath string
}

func getAffectedGroupResources(ctx context.Context, queryer migrator.Queryer, quoteFn func(string) string) ([]groupResource, error) {
	query := fmt.Sprintf(`
		SELECT DISTINCT %s, %s FROM (
			SELECT %s, %s FROM resource_history WHERE resource_version < %d
			UNION
			SELECT %s, %s FROM resource WHERE resource_version < %d
		) AS combined`,
		quoteFn("group"), quoteFn("resource"),
		quoteFn("group"), quoteFn("resource"), rvFloor,
		quoteFn("group"), quoteFn("resource"), rvFloor,
	)

	rows, err := sqlutil.QueryMaps(ctx, queryer, query)
	if err != nil {
		return nil, err
	}

	results := make([]groupResource, 0, len(rows))
	for _, row := range rows {
		results = append(results, groupResource{
			group:    string(row["group"]),
			resource: string(row["resource"]),
		})
	}
	return results, nil
}

func fixGroupResource(ctx context.Context, queryer migrator.Queryer, quoteFn func(string) string, mg *migrator.Migrator, gr groupResource) error {
	// Collect bad records from resource_history
	badRecords, err := collectBadRecords(ctx, queryer, quoteFn, gr)
	if err != nil {
		return fmt.Errorf("collecting bad records: %w", err)
	}
	if len(badRecords) == 0 {
		return nil
	}

	// Find the ceiling (first valid RV >= rvFloor)
	ceiling, err := findRVCeiling(ctx, queryer, quoteFn, mg, gr)
	if err != nil {
		return fmt.Errorf("finding ceiling: %w", err)
	}

	// Handle insufficient slots by moving the ceiling record up
	availableSlots := ceiling - rvFloor
	if int64(len(badRecords)) > availableSlots {
		err = makeSlotsAvailable(ctx, queryer, quoteFn, mg, gr, ceiling, int64(len(badRecords)))
		if err != nil {
			return fmt.Errorf("making slots available: %w", err)
		}
	}

	// Build update entries
	updates := make([]rvUpdateEntry, 0, len(badRecords))
	for i, rec := range badRecords {
		oldRV := rec.ResourceVersion
		newRV := rvFloor + int64(i)
		rec.ResourceVersion = newRV
		updates = append(updates, rvUpdateEntry{
			guid:    rec.GUID,
			oldRV:   oldRV,
			newRV:   newRV,
			keyPath: parseKeyPath(rec),
		})
	}

	// Apply updates in batches
	for start := 0; start < len(updates); start += rvFixBatchSize {
		end := start + rvFixBatchSize
		if end > len(updates) {
			end = len(updates)
		}
		batch := updates[start:end]

		if err := updatePrevRVRefs(ctx, queryer, quoteFn, gr, batch); err != nil {
			return fmt.Errorf("updating previous_resource_version refs: %w", err)
		}
		if err := updateHistoryRVs(ctx, queryer, batch); err != nil {
			return fmt.Errorf("updating resource_history RVs: %w", err)
		}
		if err := updateResourceRVs(ctx, queryer, batch); err != nil {
			return fmt.Errorf("updating resource RVs: %w", err)
		}
	}
	return nil
}

func collectBadRecords(ctx context.Context, queryer migrator.Queryer, quoteFn func(string) string, gr groupResource) ([]resourceHistoryRow, error) {
	query := fmt.Sprintf(`
		SELECT %s, %s, %s, %s, %s, %s, %s, %s
		FROM resource_history
		WHERE %s = '%s' AND %s = '%s' AND resource_version < %d
		ORDER BY resource_version ASC`,
		quoteFn("guid"), quoteFn("namespace"), quoteFn("name"), quoteFn("resource_version"), quoteFn("action"),
		quoteFn("folder"), quoteFn("group"), quoteFn("resource"),
		quoteFn("group"), gr.group, quoteFn("resource"), gr.resource, rvFloor,
	)

	rows, err := queryer.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	return scanResourceHistoryRows(rows)
}

func findRVCeiling(ctx context.Context, queryer migrator.Queryer, quoteFn func(string) string, mg *migrator.Migrator, gr groupResource) (int64, error) {
	query := fmt.Sprintf(`
		SELECT MIN(resource_version) AS rv FROM (
			SELECT resource_version FROM resource_history
			WHERE %s = '%s' AND %s = '%s' AND resource_version >= %d
			UNION
			SELECT resource_version FROM resource
			WHERE %s = '%s' AND %s = '%s' AND resource_version >= %d
		) AS combined`,
		quoteFn("group"), gr.group, quoteFn("resource"), gr.resource, rvFloor,
		quoteFn("group"), gr.group, quoteFn("resource"), gr.resource, rvFloor,
	)

	results, err := sqlutil.QueryMaps(ctx, queryer, query)
	if err != nil {
		return 0, err
	}
	if len(results) == 0 || results[0]["rv"] == nil || string(results[0]["rv"]) == "" {
		// No valid records exist — use the database's current epoch
		return getCurrentDBEpoch(ctx, queryer, mg)
	}

	var ceiling int64
	if _, err := fmt.Sscanf(string(results[0]["rv"]), "%d", &ceiling); err != nil {
		return 0, fmt.Errorf("parsing ceiling value: %w", err)
	}
	return ceiling, nil
}

func getCurrentDBEpoch(ctx context.Context, queryer migrator.Queryer, mg *migrator.Migrator) (int64, error) {
	var epochQuery string
	switch mg.Dialect.DriverName() {
	case migrator.MySQL:
		epochQuery = "SELECT CAST(FLOOR(UNIX_TIMESTAMP(NOW(6)) * 1000000) AS SIGNED) AS epoch"
	case migrator.Postgres:
		epochQuery = "SELECT (EXTRACT(EPOCH FROM statement_timestamp()) * 1000000)::BIGINT AS epoch"
	case migrator.SQLite:
		epochQuery = "SELECT CAST((julianday('now') - 2440587.5) * 86400000000.0 AS BIGINT) AS epoch"
	default:
		return 0, fmt.Errorf("unsupported database dialect: %s", mg.Dialect.DriverName())
	}

	results, err := sqlutil.QueryMaps(ctx, queryer, epochQuery)
	if err != nil {
		return 0, fmt.Errorf("querying current epoch: %w", err)
	}
	if len(results) == 0 {
		return 0, fmt.Errorf("no result from epoch query")
	}

	var epoch int64
	if _, err := fmt.Sscanf(string(results[0]["epoch"]), "%d", &epoch); err != nil {
		return 0, fmt.Errorf("parsing epoch value: %w", err)
	}
	return epoch, nil
}

func makeSlotsAvailable(ctx context.Context, queryer migrator.Queryer, quoteFn func(string) string, _ *migrator.Migrator, gr groupResource, ceiling int64, needed int64) error {
	targetMinCeiling := rvFloor + needed
	if ceiling >= targetMinCeiling {
		return nil
	}

	// Move every valid RV that blocks the [rvFloor, targetMinCeiling) range.
	blockingRVs, err := findBlockingRVs(ctx, queryer, quoteFn, gr, ceiling, targetMinCeiling)
	if err != nil {
		return fmt.Errorf("finding blocking RVs: %w", err)
	}
	if len(blockingRVs) == 0 {
		return nil
	}

	freeRVs, err := findFreeRVsByScan(ctx, queryer, quoteFn, gr, ceiling, targetMinCeiling, len(blockingRVs))
	if err != nil {
		return fmt.Errorf("finding free RVs by scan: %w", err)
	}
	if len(freeRVs) < len(blockingRVs) {
		return fmt.Errorf("insufficient RV slots while preserving max RV: need %d free slots >= %d, found %d",
			len(blockingRVs), targetMinCeiling, len(freeRVs))
	}

	// Preserve order by mapping lower old RVs to lower free RVs.
	for i, oldRV := range blockingRVs {
		newRV := freeRVs[i]
		if err := moveCeilingRecord(ctx, queryer, quoteFn, gr, oldRV, newRV); err != nil {
			return fmt.Errorf("moving RV %d to %d: %w", oldRV, newRV, err)
		}
	}

	return nil
}

func findBlockingRVs(ctx context.Context, queryer migrator.Queryer, quoteFn func(string) string, gr groupResource, fromRV, toRV int64) ([]int64, error) {
	query := fmt.Sprintf(`
		SELECT resource_version AS rv FROM (
			SELECT resource_version FROM resource_history
			WHERE %s = '%s' AND %s = '%s' AND resource_version >= %d AND resource_version < %d
			UNION
			SELECT resource_version FROM resource
			WHERE %s = '%s' AND %s = '%s' AND resource_version >= %d AND resource_version < %d
		) AS combined
		ORDER BY rv ASC`,
		quoteFn("group"), gr.group, quoteFn("resource"), gr.resource, fromRV, toRV,
		quoteFn("group"), gr.group, quoteFn("resource"), gr.resource, fromRV, toRV,
	)

	rows, err := sqlutil.QueryMaps(ctx, queryer, query)
	if err != nil {
		return nil, err
	}

	rvs := make([]int64, 0, len(rows))
	for _, row := range rows {
		var rv int64
		if _, err := fmt.Sscanf(string(row["rv"]), "%d", &rv); err != nil {
			return nil, fmt.Errorf("parsing blocking RV: %w", err)
		}
		rvs = append(rvs, rv)
	}
	return rvs, nil
}

func findFreeRVsByScan(ctx context.Context, queryer migrator.Queryer, quoteFn func(string) string, gr groupResource, startRV, minDestinationRV int64, count int) ([]int64, error) {
	if count <= 0 {
		return nil, nil
	}

	free := make([]int64, 0, count)
	cursor := startRV

	for len(free) < count {
		occupiedBatch, err := fetchHistoryRVsBatch(ctx, queryer, quoteFn, gr, cursor, rvScanBatchSize)
		if err != nil {
			return nil, err
		}
		if len(occupiedBatch) == 0 {
			// No additional rows means no more in-table gaps at/after minDestinationRV.
			return free, nil
		}

		for _, occupiedRV := range occupiedBatch {
			if occupiedRV < cursor {
				continue
			}

			for cursor < occupiedRV {
				// Do not use slots below the reserved bad-record rewrite range.
				if cursor >= minDestinationRV {
					free = append(free, cursor)
					if len(free) == count {
						return free, nil
					}
				}
				cursor++
			}

			// Skip this occupied RV.
			cursor = occupiedRV + 1
		}
	}

	return free, nil
}

func fetchHistoryRVsBatch(ctx context.Context, queryer migrator.Queryer, quoteFn func(string) string, gr groupResource, fromRV int64, limit int) ([]int64, error) {
	query := fmt.Sprintf(`
		SELECT resource_version AS rv
		FROM resource_history
		WHERE %s = '%s' AND %s = '%s' AND resource_version >= %d
		ORDER BY resource_version ASC
		LIMIT %d`,
		quoteFn("group"), gr.group, quoteFn("resource"), gr.resource, fromRV, limit,
	)

	rows, err := sqlutil.QueryMaps(ctx, queryer, query)
	if err != nil {
		return nil, err
	}

	rvs := make([]int64, 0, len(rows))
	for _, row := range rows {
		var rv int64
		if _, err := fmt.Sscanf(string(row["rv"]), "%d", &rv); err != nil {
			return nil, fmt.Errorf("parsing scanned RV: %w", err)
		}
		rvs = append(rvs, rv)
	}
	return rvs, nil
}

func moveCeilingRecord(ctx context.Context, queryer migrator.Queryer, q func(string) string, gr groupResource, oldRV, newRV int64) error {
	// Find resource_history records at the ceiling
	histQuery := fmt.Sprintf(`
		SELECT %s, %s, %s, %s, %s, %s, %s, %s
		FROM resource_history
		WHERE %s = '%s' AND %s = '%s' AND resource_version = %d`,
		q("guid"), q("namespace"), q("name"), q("resource_version"), q("action"),
		q("folder"), q("group"), q("resource"),
		q("group"), gr.group, q("resource"), gr.resource, oldRV,
	)

	rows, err := queryer.QueryContext(ctx, histQuery)
	if err != nil {
		return fmt.Errorf("finding ceiling history records: %w", err)
	}
	defer func() { _ = rows.Close() }()

	histRows, err := scanResourceHistoryRows(rows)
	if err != nil {
		return fmt.Errorf("scanning ceiling history records: %w", err)
	}

	for _, row := range histRows {
		row.Group = gr.group
		row.Resource = gr.resource
		row.ResourceVersion = newRV
		newKeyPath := parseKeyPath(row)

		updateSQL := fmt.Sprintf(`
			UPDATE resource_history
			SET resource_version = %d, key_path = '%s'
			WHERE guid = '%s'`,
			newRV, escapeSQLString(newKeyPath), escapeSQLString(row.GUID),
		)
		if _, err := queryer.ExecContext(ctx, updateSQL); err != nil {
			return fmt.Errorf("updating ceiling history record: %w", err)
		}
	}

	// Update resource table records at the ceiling
	resUpdateSQL := fmt.Sprintf(`
		UPDATE resource
		SET resource_version = %d
		WHERE %s = '%s' AND %s = '%s' AND resource_version = %d`,
		newRV,
		q("group"), escapeSQLString(gr.group), q("resource"), escapeSQLString(gr.resource), oldRV,
	)
	if _, err := queryer.ExecContext(ctx, resUpdateSQL); err != nil {
		return fmt.Errorf("updating ceiling resource record: %w", err)
	}

	// Update previous_resource_version references to the old ceiling
	prevHistSQL := fmt.Sprintf(`
		UPDATE resource_history
		SET previous_resource_version = %d
		WHERE %s = '%s' AND %s = '%s' AND previous_resource_version = %d`,
		newRV,
		q("group"), escapeSQLString(gr.group), q("resource"), escapeSQLString(gr.resource), oldRV,
	)
	if _, err := queryer.ExecContext(ctx, prevHistSQL); err != nil {
		return fmt.Errorf("updating previous_resource_version refs in history: %w", err)
	}

	prevResSQL := fmt.Sprintf(`
		UPDATE resource
		SET previous_resource_version = %d
		WHERE %s = '%s' AND %s = '%s' AND previous_resource_version = %d`,
		newRV,
		q("group"), escapeSQLString(gr.group), q("resource"), escapeSQLString(gr.resource), oldRV,
	)
	if _, err := queryer.ExecContext(ctx, prevResSQL); err != nil {
		return fmt.Errorf("updating previous_resource_version refs in resource: %w", err)
	}

	return nil
}

func updatePrevRVRefs(ctx context.Context, queryer migrator.Queryer, q func(string) string, gr groupResource, batch []rvUpdateEntry) error {
	if len(batch) == 0 {
		return nil
	}

	// Build old RV -> new RV mapping
	rvMap := make(map[int64]int64, len(batch))
	oldRVList := make([]string, 0, len(batch))
	for _, u := range batch {
		rvMap[u.oldRV] = u.newRV
		oldRVList = append(oldRVList, fmt.Sprintf("%d", u.oldRV))
	}
	inClause := strings.Join(oldRVList, ", ")

	// Find and update resource_history previous_resource_version refs
	histSelectSQL := fmt.Sprintf(`
		SELECT guid, previous_resource_version
		FROM resource_history
		WHERE %s = '%s' AND %s = '%s' AND previous_resource_version IN (%s)`,
		q("group"), escapeSQLString(gr.group), q("resource"), escapeSQLString(gr.resource), inClause,
	)

	histResults, err := sqlutil.QueryMaps(ctx, queryer, histSelectSQL)
	if err != nil {
		return fmt.Errorf("querying history prev RV refs: %w", err)
	}

	if len(histResults) > 0 {
		caseClause := "CASE guid"
		guidList := make([]string, 0, len(histResults))
		for _, row := range histResults {
			guid := string(row["guid"])
			var prevRV int64
			if _, err := fmt.Sscanf(string(row["previous_resource_version"]), "%d", &prevRV); err != nil {
				return fmt.Errorf("parsing history previous_resource_version for guid %q: %w", guid, err)
			}
			if newRV, ok := rvMap[prevRV]; ok {
				caseClause += fmt.Sprintf(" WHEN '%s' THEN %d", escapeSQLString(guid), newRV)
				guidList = append(guidList, fmt.Sprintf("'%s'", escapeSQLString(guid)))
			}
		}
		caseClause += " END"

		if len(guidList) > 0 {
			updateSQL := fmt.Sprintf(`
				UPDATE resource_history
				SET previous_resource_version = %s
				WHERE guid IN (%s)`,
				caseClause, strings.Join(guidList, ", "),
			)
			if _, err := queryer.ExecContext(ctx, updateSQL); err != nil {
				return fmt.Errorf("updating history prev RV refs: %w", err)
			}
		}
	}

	// Find and update resource previous_resource_version refs
	resSelectSQL := fmt.Sprintf(`
		SELECT guid, previous_resource_version
		FROM resource
		WHERE %s = '%s' AND %s = '%s' AND previous_resource_version IN (%s)`,
		q("group"), escapeSQLString(gr.group), q("resource"), escapeSQLString(gr.resource), inClause,
	)

	resResults, err := sqlutil.QueryMaps(ctx, queryer, resSelectSQL)
	if err != nil {
		return fmt.Errorf("querying resource prev RV refs: %w", err)
	}

	if len(resResults) > 0 {
		caseClause := "CASE guid"
		guidList := make([]string, 0, len(resResults))
		for _, row := range resResults {
			guid := string(row["guid"])
			var prevRV int64
			if _, err := fmt.Sscanf(string(row["previous_resource_version"]), "%d", &prevRV); err != nil {
				return fmt.Errorf("parsing resource previous_resource_version for guid %q: %w", guid, err)
			}
			if newRV, ok := rvMap[prevRV]; ok {
				caseClause += fmt.Sprintf(" WHEN '%s' THEN %d", escapeSQLString(guid), newRV)
				guidList = append(guidList, fmt.Sprintf("'%s'", escapeSQLString(guid)))
			}
		}
		caseClause += " END"

		if len(guidList) > 0 {
			updateSQL := fmt.Sprintf(`
				UPDATE resource
				SET previous_resource_version = %s
				WHERE guid IN (%s)`,
				caseClause, strings.Join(guidList, ", "),
			)
			if _, err := queryer.ExecContext(ctx, updateSQL); err != nil {
				return fmt.Errorf("updating resource prev RV refs: %w", err)
			}
		}
	}

	return nil
}

func updateHistoryRVs(ctx context.Context, queryer migrator.Queryer, batch []rvUpdateEntry) error {
	if len(batch) == 0 {
		return nil
	}

	rvCase := "CASE guid"
	keyPathCase := "CASE guid"
	guidList := make([]string, 0, len(batch))

	for _, u := range batch {
		quotedGUID := fmt.Sprintf("'%s'", escapeSQLString(u.guid))
		rvCase += fmt.Sprintf(" WHEN %s THEN %d", quotedGUID, u.newRV)
		keyPathCase += fmt.Sprintf(" WHEN %s THEN '%s'", quotedGUID, escapeSQLString(u.keyPath))
		guidList = append(guidList, quotedGUID)
	}

	rvCase += " END"
	keyPathCase += " END"

	sql := fmt.Sprintf(`
		UPDATE resource_history
		SET resource_version = %s, key_path = %s
		WHERE guid IN (%s)`,
		rvCase, keyPathCase, strings.Join(guidList, ", "),
	)

	if _, err := queryer.ExecContext(ctx, sql); err != nil {
		return fmt.Errorf("updating resource_history records: %w", err)
	}
	return nil
}

func updateResourceRVs(ctx context.Context, queryer migrator.Queryer, batch []rvUpdateEntry) error {
	if len(batch) == 0 {
		return nil
	}

	rvCase := "CASE guid"
	guidList := make([]string, 0, len(batch))

	for _, u := range batch {
		quotedGUID := fmt.Sprintf("'%s'", escapeSQLString(u.guid))
		rvCase += fmt.Sprintf(" WHEN %s THEN %d", quotedGUID, u.newRV)
		guidList = append(guidList, quotedGUID)
	}
	rvCase += " END"

	sql := fmt.Sprintf(`
		UPDATE resource
		SET resource_version = %s
		WHERE guid IN (%s)`,
		rvCase, strings.Join(guidList, ", "),
	)

	if _, err := queryer.ExecContext(ctx, sql); err != nil {
		return fmt.Errorf("updating resource records: %w", err)
	}
	return nil
}

func scanResourceHistoryRows(rows *sql.Rows) ([]resourceHistoryRow, error) {
	result := make([]resourceHistoryRow, 0)
	for rows.Next() {
		row := resourceHistoryRow{}
		if err := rows.Scan(
			&row.GUID,
			&row.Namespace,
			&row.Name,
			&row.ResourceVersion,
			&row.Action,
			&row.Folder,
			&row.Group,
			&row.Resource,
		); err != nil {
			return nil, err
		}
		result = append(result, row)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
}
