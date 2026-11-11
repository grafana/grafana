package federated

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"sync/atomic"
	"time"

	claims "github.com/grafana/authlib/types"

	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// folderBatchSize caps how many folder UIDs are bound into a single IN (...)
// clause. SQLite's default SQLITE_MAX_VARIABLE_NUMBER is 999, so 500 leaves
// headroom for the orgID placeholder and stays well under MySQL/Postgres limits.
const folderBatchSize = 500

// Config section keys for the resources that own the legacy tables counted below.
const (
	alertRuleResource     = "alertrules.rules.alerting.grafana.app"
	recordingRuleResource = "recordingrules.rules.alerting.grafana.app"
	libraryPanelResource  = "librarypanels.dashboard.grafana.app"
	libraryPanelMigration = "librarypanels migration"
	migrationLogTable     = "unifiedstorage_migration_log"
)

// LegacyCountedResources is guarded by a test: once one of these gets a migration
// registered, legacyTableIsStale has to read the migration status instead of config.
var LegacyCountedResources = []string{alertRuleResource, recordingRuleResource}

// Read stats from legacy SQL
type LegacyStatsGetter struct {
	SQL legacysql.LegacyDatabaseProvider
	Cfg *setting.Cfg

	metrics *legacyStatsMetrics
	logger  log.Logger // defaults to the folder.counts logger

	unavailableLogged atomic.Bool
}

// CountError identifies which legacy resource count failed while preserving the underlying error.
type CountError struct {
	Resources []string
	Err       error
}

func (e *CountError) Error() string { return e.Err.Error() }
func (e *CountError) Unwrap() error { return e.Err }

var ErrLegacyStatsUnavailable = errors.New("legacy stats source is unavailable")

// kv_store convention used to mark a resource as fully migrated for one stack: namespace
// "unified_storage.is_migrated", key "<resource>.<group>" (the same string shape as our own
// alertRuleResource-style constants), org_id always 0 for this entry specifically (unlike
// every other row in these stack databases, which use 1).
const (
	migratedKVNamespace = "unified_storage.is_migrated"
	migratedKVValue     = "true"
)

// From mode 4 on nothing writes the legacy table, so its rows are leftovers and counting
// them would warn about resources that no longer exist. Library panels can also be
// migrated while still in mode 1, so their successful migration log takes precedence
// over config, as it does for the dual-writer's storage mode resolution.
//
// A caller with no DualWriterMode config at all (nil Cfg) falls back to a per-stack kv_store
// marker instead -- the only signal that exists there today.
func (s *LegacyStatsGetter) legacyTableIsStale(sess *sqlstore.DBSession, helper *legacysql.LegacyDatabaseHelper, resource string) (bool, error) {
	if s.Cfg != nil {
		if resource == libraryPanelResource {
			exists, err := sess.IsTableExist(helper.Table(migrationLogTable))
			if err != nil {
				return false, err
			}
			if exists {
				count, err := sess.Table(helper.Table(migrationLogTable)).
					Where("migration_id = ? AND success = ?", libraryPanelMigration, true).
					Count()
				if err != nil {
					return false, err
				}
				if count > 0 {
					return true, nil
				}
			}
		}
		return s.Cfg.UnifiedStorage[resource].DualWriterMode >= grafanarest.Mode4, nil
	}

	count, err := sess.Table(helper.Table("kv_store")).
		Where("org_id = 0 AND namespace = ? AND "+helper.DB.Quote("key")+" = ? AND value = ?", migratedKVNamespace, resource, migratedKVValue).
		Count()
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (s *LegacyStatsGetter) GetStats(ctx context.Context, in *resourcepb.ResourceStatsRequest) (*resourcepb.ResourceStatsResponse, error) {
	if s.SQL == nil {
		s.lookupFailed(ctx, in, ErrLegacyStatsUnavailable, time.Now())
		return nil, &CountError{Resources: LegacyCountedResources, Err: ErrLegacyStatsUnavailable}
	}
	info, err := claims.ParseNamespace(in.Namespace)
	if err != nil {
		return nil, fmt.Errorf("unable to read namespace")
	}
	if info.OrgID == 0 {
		return nil, fmt.Errorf("invalid OrgID found in namespace")
	}

	lookupStart := time.Now()
	helper, err := s.SQL(ctx)
	if errors.Is(err, legacysql.ErrNamespaceDeleted) {
		// The stack was deleted or migrated away and its namespace is being torn down. Fall back
		// to the unified storage counts alone, as when legacy counts are disabled; failing here
		// turns every folder delete in that namespace into a 500. Any other lookup failure,
		// including a stack that is only unavailable (e.g. archived or suspended), still fails:
		// its legacy rows can come back, so it must not be treated as empty.
		for _, resource := range legacyResources {
			s.skipped(ctx, in, "", resource, legacySkipNamespaceDeleted)
		}
		return &resourcepb.ResourceStatsResponse{}, nil
	}
	if err != nil {
		s.lookupFailed(ctx, in, err, lookupStart)
		return nil, &CountError{Resources: LegacyCountedResources, Err: err}
	}

	folders := folderSet(in)

	rsp := &resourcepb.ResourceStatsResponse{}
	err = helper.DB.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		// extraWhere, when non-empty, is ANDed onto the org+folder filter. It must be a
		// literal fragment with no bound parameters.
		fn := func(table, folderCol, g, r string, extraWhere string) error {
			tableName := helper.Table(table)
			countChunk := func(chunk []string) (int64, error) {
				where, args := buildFolderWhere(folderCol, info.OrgID, chunk)
				if extraWhere != "" {
					where += " AND " + extraWhere
				}
				start := time.Now()
				c, err := sess.Table(tableName).Where(where, args...).Count()
				s.accessed(ctx, in, helper.Server, r, start, err)
				return c, err
			}

			var total int64
			if len(folders) == 0 {
				c, err := countChunk(nil)
				if err != nil {
					return err
				}
				total = c
			} else {
				for chunk := range slices.Chunk(folders, folderBatchSize) {
					c, err := countChunk(chunk)
					if err != nil {
						return err
					}
					total += c
				}
			}

			rsp.Stats = append(rsp.Stats, &resourcepb.ResourceStatsResponse_Stats{
				Group:    g, // all legacy for now
				Resource: r,
				Count:    total,
			})
			return nil
		}
		// Indicate that this came from the SQL tables
		group := "sql-fallback"

		// A failed staleness check is a legacy database failure too, so it is recorded as an error.
		isStale := func(configKey, name string) (bool, error) {
			start := time.Now()
			stale, err := s.legacyTableIsStale(sess, helper, configKey)
			if err != nil {
				s.accessed(ctx, in, helper.Server, name, start, err)
				return false, &CountError{Resources: []string{name}, Err: err}
			}
			return stale, nil
		}

		// Legacy alert rule table. Alert rules and recording rules share this table and are
		// told apart by the `record` column, so count them separately — reporting the whole
		// table as "alertrules" makes callers that read both kinds count recording rules
		// twice. The two predicates are exhaustive and don't overlap, so they still add up
		// to the row count this used to return on its own.
		//
		// `record` is nullable and rows written before it existed were never backfilled, so
		// NULL has to count as "not a recording rule". Comparing NULL with = or != yields
		// NULL rather than true, which would drop those rows from both counts and let a
		// folder that still holds alert rules look empty.
		alertRulesStale, err := isStale(alertRuleResource, legacyAlertRules)
		if err != nil {
			return err
		}
		if alertRulesStale {
			s.skipped(ctx, in, helper.Server, legacyAlertRules, legacySkipMigrated)
		} else {
			err = fn("alert_rule", "namespace_uid", group, legacyAlertRules, "(record IS NULL OR record = '')")
			if err != nil {
				return &CountError{Resources: []string{legacyAlertRules}, Err: err}
			}
		}

		recordingRulesStale, err := isStale(recordingRuleResource, legacyRecordingRules)
		if err != nil {
			return err
		}
		if recordingRulesStale {
			s.skipped(ctx, in, helper.Server, legacyRecordingRules, legacySkipMigrated)
		} else {
			err = fn("alert_rule", "namespace_uid", group, legacyRecordingRules, "(record IS NOT NULL AND record != '')")
			if err != nil {
				return &CountError{Resources: []string{legacyRecordingRules}, Err: err}
			}
		}

		// Legacy library_elements table
		libraryPanelsStale, err := isStale(libraryPanelResource, legacyLibraryElements)
		if err != nil {
			return err
		}
		if libraryPanelsStale {
			s.skipped(ctx, in, helper.Server, legacyLibraryElements, legacySkipMigrated)
		} else {
			err = fn("library_element", "folder_uid", group, legacyLibraryElements, "")
			if err != nil {
				return &CountError{Resources: []string{legacyLibraryElements}, Err: err}
			}
		}
		return nil
	})

	return rsp, err
}

type callerKey struct{}

// WithCaller names who asked for a folder count, so its log lines can say so. The value only
// travels in-process.
func WithCaller(ctx context.Context, caller string) context.Context {
	return context.WithValue(ctx, callerKey{}, caller)
}

// CallerFrom returns the caller set by WithCaller, or an empty string.
func CallerFrom(ctx context.Context) string {
	caller, _ := ctx.Value(callerKey{}).(string)
	return caller
}

// countsLogger is the default logger of the folder count paths.
var countsLogger = log.New("folder.counts")

// log returns the logger carrying the request's trace context.
func (s *LegacyStatsGetter) log(ctx context.Context) log.Logger {
	if s.logger != nil {
		return s.logger.FromContext(ctx)
	}
	return countsLogger.FromContext(ctx)
}

// logFields are the fields shared by every folder count log line. A request can carry many
// folders, so only the first is named.
func logFields(ctx context.Context, in *resourcepb.ResourceStatsRequest, server, resource string) []any {
	fields := []any{"namespace", in.Namespace, "folderCount", len(in.Folder), "resource", resource}
	if caller := CallerFrom(ctx); caller != "" {
		fields = append(fields, "caller", caller)
	}
	if len(in.Folder) > 0 {
		fields = append(fields, "folder", in.Folder[0])
	}
	if server != "" {
		fields = append(fields, "dbServer", server)
	}
	return fields
}

// accessed records the metric and the log line for one legacy database query. A caller that went
// away is not a failure, so it only logs at debug level.
func (s *LegacyStatsGetter) accessed(ctx context.Context, in *resourcepb.ResourceStatsRequest, server, resource string, start time.Time, err error) {
	s.metrics.observe(resource, start, err)
	fields := append(logFields(ctx, in, server, resource), "duration", time.Since(start), "outcome", legacyOutcome(err))
	switch {
	case err == nil:
		s.log(ctx).Debug("Counted legacy resources", fields...)
	case errors.Is(err, context.Canceled):
		s.log(ctx).Debug("Legacy count canceled", append(fields, "error", err)...)
	default:
		s.log(ctx).Error("Legacy count failed", append(fields, "error", err)...)
	}
}

// skipped records the metric and the log line for a legacy count that was not run.
func (s *LegacyStatsGetter) skipped(ctx context.Context, in *resourcepb.ResourceStatsRequest, server, resource, reason string) {
	s.metrics.skip(resource, reason)
	s.log(ctx).Debug("Skipped legacy count", append(logFields(ctx, in, server, resource), "reason", reason)...)
}

// lookupFailed records a failure to reach the legacy database before any resource is counted.
func (s *LegacyStatsGetter) lookupFailed(ctx context.Context, in *resourcepb.ResourceStatsRequest, err error, start time.Time) {
	s.metrics.observeAll(start, err)
	fields := append(logFields(ctx, in, "", "all"), "duration", time.Since(start), "outcome", legacyOutcome(err), "error", err)
	// A missing legacy source is a configuration state that repeats on every request, so only
	// its first occurrence is an error; the outcome metric still counts each one.
	if errors.Is(err, ErrLegacyStatsUnavailable) && s.unavailableLogged.Swap(true) {
		s.log(ctx).Debug("Legacy count source still unavailable", fields...)
		return
	}
	if errors.Is(err, context.Canceled) {
		s.log(ctx).Debug("Legacy database lookup canceled", fields...)
		return
	}
	s.log(ctx).Error("Legacy database lookup failed", fields...)
}

// folderSet returns in.Folder deduped, with empty entries dropped. Returns
// nil when no folder filter is set.
func folderSet(in *resourcepb.ResourceStatsRequest) []string {
	if len(in.Folder) == 0 {
		return nil
	}
	seen := make(map[string]struct{}, len(in.Folder))
	out := make([]string, 0, len(in.Folder))
	for _, f := range in.Folder {
		if f == "" {
			continue
		}
		if _, ok := seen[f]; ok {
			continue
		}
		seen[f] = struct{}{}
		out = append(out, f)
	}
	return out
}

// buildFolderWhere returns the WHERE fragment + bound args for an org+folder
// filter over a single folder UID column. Uses IN (...) when more than one
// folder is supplied so the legacy fallback matches the recursive semantics
// of the unified-storage path.
func buildFolderWhere(folderCol string, orgID int64, folders []string) (string, []any) {
	switch len(folders) {
	case 0:
		return "org_id=?", []any{orgID}
	case 1:
		return "org_id=? AND " + folderCol + "=?", []any{orgID, folders[0]}
	}
	placeholders := strings.Repeat("?,", len(folders))
	placeholders = placeholders[:len(placeholders)-1]
	args := make([]any, 0, len(folders)+1)
	args = append(args, orgID)
	for _, f := range folders {
		args = append(args, f)
	}
	return "org_id=? AND " + folderCol + " IN (" + placeholders + ")", args
}
