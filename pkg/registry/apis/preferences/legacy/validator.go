package legacy

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/xorm"
)

// preferencesCountValidation enforces strict count parity between the legacy
// preferences table and unified storage. It mirrors migrations.CountValidator
// but uses a bespoke query that counts exactly what the migrator emits:
// namespace rows (user_id = 0 AND team_id = 0), user-prefs whose user still
// exists, and team-prefs whose team still exists. Orphan rows are skipped on
// the read side (see listPreferences), so they must not be counted here
// either, or the validator would false-fail.
func preferencesCountValidation(resource schema.GroupResource) migrations.ValidatorFactory {
	return func(client resourcepb.ResourceIndexClient, driverName string) migrations.Validator {
		return &preferencesCountValidator{
			resource:   resource,
			client:     client,
			driverName: driverName,
		}
	}
}

type preferencesCountValidator struct {
	resource   schema.GroupResource
	client     resourcepb.ResourceIndexClient
	driverName string
}

func (v *preferencesCountValidator) Name() string { return "PreferencesCountValidator" }

func (v *preferencesCountValidator) Validate(ctx context.Context, sess *xorm.Session, response *resourcepb.BulkResponse, log log.Logger) error {
	summary := v.findSummary(response)
	if summary == nil {
		log.Debug("No summary for preferences, skipping count validation")
		return nil
	}

	rejected := v.countRejected(response, log)

	orgID, err := migrations.ParseOrgIDFromNamespace(summary.Namespace)
	if err != nil {
		return fmt.Errorf("invalid namespace %s: %w", summary.Namespace, err)
	}

	legacyCount, err := v.countLegacy(sess, orgID)
	if err != nil {
		return fmt.Errorf("failed to count legacy preferences: %w", err)
	}

	unifiedCount, err := v.countUnified(ctx, sess, summary)
	if err != nil {
		return fmt.Errorf("failed to count unified preferences: %w", err)
	}

	expected := unifiedCount + rejected

	log.Info("Preferences count validation",
		"namespace", summary.Namespace,
		"legacy", legacyCount,
		"unified", unifiedCount,
		"rejected", rejected,
		"summary_count", summary.Count)

	// Strict equality: every legacy row the migrator would emit must be
	// reflected in unified storage (or rejected). Catches both data loss
	// (legacy > expected) and unexpected extra rows (legacy < expected).
	if legacyCount != expected {
		return fmt.Errorf("preferences count mismatch for namespace %s: legacy=%d, unified=%d, rejected=%d",
			summary.Namespace, legacyCount, unifiedCount, rejected)
	}

	return nil
}

func (v *preferencesCountValidator) findSummary(response *resourcepb.BulkResponse) *resourcepb.BulkResponse_Summary {
	for _, s := range response.Summary {
		if s.Group == v.resource.Group && s.Resource == v.resource.Resource {
			return s
		}
	}
	return nil
}

func (v *preferencesCountValidator) countRejected(response *resourcepb.BulkResponse, log log.Logger) int64 {
	var n int64
	for i, r := range response.Rejected {
		if r.Key == nil || r.Key.Group != v.resource.Group || r.Key.Resource != v.resource.Resource {
			continue
		}
		n++
		if i < 10 {
			log.Warn("Rejected preferences item",
				"namespace", r.Key.Namespace,
				"name", r.Key.Name,
				"reason", r.Error)
		}
	}
	return n
}

// countLegacy mirrors the listPreferences read path: include namespace rows
// (user_id = 0 AND team_id = 0), user rows whose user still exists, and team
// rows whose team still exists. The LEFT JOINs let us keep namespace rows in
// the result while still being able to test for user/team existence.
func (v *preferencesCountValidator) countLegacy(sess *xorm.Session, orgID int64) (int64, error) {
	return sess.Table("preferences").
		Join("LEFT", []string{"user", "u"}, "preferences.user_id = u.id").
		Join("LEFT", []string{"team", "t"}, "preferences.team_id = t.id").
		Where(`preferences.org_id = ?
			AND (preferences.user_id = 0 OR u.uid IS NOT NULL)
			AND (preferences.team_id = 0 OR t.uid IS NOT NULL)`, orgID).
		Count()
}

func (v *preferencesCountValidator) countUnified(ctx context.Context, sess *xorm.Session, summary *resourcepb.BulkResponse_Summary) (int64, error) {
	if v.driverName == migrator.SQLite {
		return sess.Table("resource").
			Where("namespace = ? AND `group` = ? AND resource = ?",
				summary.Namespace, summary.Group, summary.Resource).
			Count()
	}

	statsResp, err := v.client.GetStats(ctx, &resourcepb.ResourceStatsRequest{
		Namespace: summary.Namespace,
		Kinds:     []string{fmt.Sprintf("%s/%s", summary.Group, summary.Resource)},
	})
	if err != nil {
		return 0, err
	}
	for _, stat := range statsResp.Stats {
		if stat.Group == summary.Group && stat.Resource == summary.Resource {
			return stat.Count, nil
		}
	}
	return 0, nil
}
