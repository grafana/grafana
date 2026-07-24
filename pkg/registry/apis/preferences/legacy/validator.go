package legacy

import (
	"context"
	"database/sql"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/preferences/utils"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/xorm"
)

// PreferencesCountValidation enforces strict count parity between the legacy
// preferences table and unified storage, counting exactly what the migrator
// emits: distinct owners (namespace, valid user, valid team), excluding
// orphans. See countLegacy.
func PreferencesCountValidation(resource schema.GroupResource) migrations.ValidatorFactory {
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

// ownerRow holds the columns needed to derive a preference's resource name.
type ownerRow struct {
	UserUID sql.NullString `xorm:"user_uid"`
	TeamUID sql.NullString `xorm:"team_uid"`
}

// countLegacy counts distinct resource names, mirroring the listPreferences
// read path (LEFT JOINs exclude orphan user/team rows). Counting distinct
// names rather than raw rows matters because the name derives solely from the
// owner (see asPreferencesResource): duplicate legacy rows for the same owner
// — nothing enforces one row per org/user/team — collapse to a single resource
// in unified storage, which dedups by name. Raw-row counts would false-fail.
func (v *preferencesCountValidator) countLegacy(sess *xorm.Session, orgID int64) (int64, error) {
	var rows []ownerRow
	err := sess.Table("preferences").
		Select("u.uid AS user_uid, t.uid AS team_uid").
		Join("LEFT", []string{"user", "u"}, "preferences.user_id = u.id").
		Join("LEFT", []string{"team", "t"}, "preferences.team_id = t.id").
		Where(`preferences.org_id = ?
			AND (preferences.user_id = 0 OR u.uid IS NOT NULL)
			AND (preferences.team_id = 0 OR t.uid IS NOT NULL)`, orgID).
		Find(&rows)
	if err != nil {
		return 0, err
	}

	names := make(map[string]struct{}, len(rows))
	for _, r := range rows {
		// Mirror asPreferencesResource: team takes precedence over user.
		owner := utils.OwnerReference{}
		if r.TeamUID.Valid {
			owner.Owner = utils.TeamResourceOwner
			owner.Identifier = r.TeamUID.String
		} else if r.UserUID.Valid {
			owner.Owner = utils.UserResourceOwner
			owner.Identifier = r.UserUID.String
		} else {
			owner.Owner = utils.NamespaceResourceOwner
		}
		names[owner.AsName()] = struct{}{}
	}
	return int64(len(names)), nil
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
