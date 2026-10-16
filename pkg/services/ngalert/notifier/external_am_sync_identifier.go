package notifier

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	"github.com/grafana/grafana-app-sdk/resource"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"

	alertingnotifv1beta1 "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v1beta1"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations/ualert"
)

// fallbackSyncIdentifier is used when the datasource name has nothing usable left after cleaning it
// up (for example a name made only of symbols).
const fallbackSyncIdentifier = "auto-sync"

var nonIdentifierChars = regexp.MustCompile(`[^a-z0-9]+`)

// syncTarget is what the syncer needs to know about an org's sync setup for one tick.
type syncTarget struct {
	uid    string
	origin externalSyncOrigin
	// identifier is the name recorded on Config.status for this uid, or "" if none was recorded yet.
	identifier string
}

// identifierOrUID returns the recorded identifier, falling back to the datasource UID for syncs that
// started before identifiers were recorded (those were imported under the UID).
func (t syncTarget) identifierOrUID() string {
	if t.identifier != "" {
		return t.identifier
	}
	return t.uid
}

// resolveSyncTarget reads the org's sync setup: the datasource UID (the ini override wins over the
// Config spec), where it came from, and the identifier recorded for it. uid is "" when sync isn't
// configured.
func (s *ExternalAMSyncer) resolveSyncTarget(ctx context.Context, orgID int64) (syncTarget, error) {
	iniUID := s.settings.UnifiedAlerting.ExternalAlertmanagerUID

	cfg, err := s.getConfig(ctx, orgID)
	if err != nil {
		// The ini override doesn't need the Config resource, so sync still runs without it. It just
		// can't see a recorded identifier, so it falls back to the UID like before.
		if iniUID != "" {
			return syncTarget{uid: iniUID, origin: originIni}, nil
		}
		return syncTarget{}, err
	}

	target := syncTarget{uid: externalSyncDatasourceUIDFromConfig(cfg), origin: originAPI}
	if iniUID != "" {
		target = syncTarget{uid: iniUID, origin: originIni}
	}
	if target.uid != "" && cfg != nil {
		target.identifier = recordedSyncIdentifier(&cfg.Status, target.uid)
	}
	return target, nil
}

// getConfig reads the org's Config singleton. Returns nil, nil when it doesn't exist yet.
func (s *ExternalAMSyncer) getConfig(ctx context.Context, orgID int64) (*alertingnotifv1beta1.Config, error) {
	c, err := s.resolveCfgClient()
	if err != nil {
		return nil, err
	}
	nsCtx, ns := s.orgServiceContext(ctx, orgID)
	cfg, err := c.Get(nsCtx, resource.Identifier{Namespace: ns, Name: alertingnotifv1beta1.ConfigSingletonName})
	if k8serrors.IsNotFound(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return cfg, nil
}

// recordedSyncIdentifier returns the identifier on status if it was recorded for uid. An identifier
// recorded for a different datasource doesn't carry over: switching the sync to another datasource
// starts a new import with its own name.
func recordedSyncIdentifier(status *alertingnotifv1beta1.ConfigStatus, uid string) string {
	if status == nil || status.ExternalAlertmanagerSync == nil {
		return ""
	}
	sync := status.ExternalAlertmanagerSync
	if sync.DatasourceUid == nil || *sync.DatasourceUid != uid || sync.Identifier == nil {
		return ""
	}
	return *sync.Identifier
}

// ensureSyncIdentifier returns the identifier to import the synced configuration under, choosing and
// recording one first if needed.
//
// The choice is written to Config.status before anything is imported under it. If that write were
// lost, the next tick could choose a different name (say the datasource was renamed in between) and
// the save would then clash with the configuration already imported under the first name. So when
// the write fails, the UID is used instead, as before identifiers were recorded: the UID never
// changes, and once something is imported under it later ticks see that and keep using it.
func (s *ExternalAMSyncer) ensureSyncIdentifier(ctx context.Context, orgID int64, target syncTarget) (string, error) {
	if target.identifier != "" {
		return target.identifier, nil
	}

	raw, err := s.configReader.GetLatestAlertmanagerConfiguration(ctx, orgID)
	if err != nil {
		return "", &SyncError{Reason: ReasonConfigRead, Cause: err}
	}
	amCfg, err := Load([]byte(raw.AlertmanagerConfiguration))
	if err != nil {
		return "", &SyncError{Reason: ReasonConfigRead, Cause: fmt.Errorf("parse alertmanager configuration: %w", err)}
	}

	taken := make(map[string]struct{}, len(amCfg.ManagedRoutes)+len(amCfg.ExtraConfigs))
	for name := range amCfg.ManagedRoutes {
		taken[name] = struct{}{}
	}
	for _, ec := range amCfg.ExtraConfigs {
		taken[ec.Identifier] = struct{}{}
	}

	var candidate string
	if _, ok := taken[target.uid]; ok {
		// Imported under the UID before identifiers were recorded. Keep that name so the syncer still
		// recognises its own import.
		candidate = target.uid
	} else {
		ds, err := s.datasourceService.GetDataSource(ctx, &datasources.GetDataSourceQuery{UID: target.uid, OrgID: orgID})
		if err != nil {
			return "", &SyncError{Reason: ReasonDatasourceLookup, Cause: fmt.Errorf("look up datasource: %w", err)}
		}
		candidate = uniqueSyncIdentifier(syncIdentifierFromName(ds.Name), taken)
	}

	chosen := candidate
	err = s.writeStatus(ctx, orgID, func(prev *alertingnotifv1beta1.ConfigStatus) alertingnotifv1beta1.ConfigStatus {
		// Another Grafana instance may have recorded one first. Use theirs so every instance agrees.
		if recorded := recordedSyncIdentifier(prev, target.uid); recorded != "" {
			chosen = recorded
		} else {
			chosen = candidate
		}
		return withSyncIdentifier(prev, target.uid, target.origin, chosen)
	})
	if err != nil {
		// Another instance may have recorded one even though this write failed.
		if cfg, getErr := s.getConfig(ctx, orgID); getErr == nil && cfg != nil {
			if recorded := recordedSyncIdentifier(&cfg.Status, target.uid); recorded != "" {
				return recorded, nil
			}
		}
		s.logger.Warn("Failed to record external AM sync identifier; importing under the datasource UID", "org_id", orgID, "error", err)
		return target.uid, nil
	}
	return chosen, nil
}

// withSyncIdentifier returns prev with the identifier recorded for uid. Conditions are left alone:
// recording the name is not a sync outcome.
func withSyncIdentifier(prev *alertingnotifv1beta1.ConfigStatus, uid string, origin externalSyncOrigin, identifier string) alertingnotifv1beta1.ConfigStatus {
	st := alertingnotifv1beta1.ConfigStatus{}
	if prev != nil {
		st = *prev
	}
	uidCopy, originCopy, identifierCopy := uid, origin, identifier
	st.ExternalAlertmanagerSync = &alertingnotifv1beta1.ConfigV1beta1StatusExternalAlertmanagerSync{
		DatasourceUid: &uidCopy,
		Origin:        &originCopy,
		Identifier:    &identifierCopy,
	}
	return st
}

// syncIdentifierFromName turns a datasource name into a valid policy tree name (managed route names
// must be DNS subdomains). Anything other than a lowercase letter or digit becomes a single dash,
// dots included, since a dot next to a dash would make the name invalid.
func syncIdentifierFromName(name string) string {
	id := nonIdentifierChars.ReplaceAllString(strings.ToLower(name), "-")
	id = strings.Trim(id, "-")
	if id == "" {
		return fallbackSyncIdentifier
	}
	return id
}

// uniqueSyncIdentifier returns base, or base with a "-2", "-3", ... suffix if base is already used by
// a policy tree or another imported configuration. The result stays within the managed route name
// length limit.
func uniqueSyncIdentifier(base string, taken map[string]struct{}) string {
	for n := 1; ; n++ {
		suffix := ""
		if n > 1 {
			suffix = fmt.Sprintf("-%d", n)
		}
		id := base
		if len(id)+len(suffix) > ualert.UIDMaxLength {
			id = strings.TrimRight(id[:ualert.UIDMaxLength-len(suffix)], "-")
		}
		id += suffix
		if _, ok := taken[id]; !ok {
			return id
		}
	}
}
