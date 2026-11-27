package notifier

import (
	"context"
	"fmt"
	"regexp"
	"slices"
	"strings"

	"github.com/grafana/grafana-app-sdk/resource"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"

	alertingnotifv1beta1 "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v1beta1"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
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
	// syncSucceeded is whether Config.status already reports a successful sync for this uid and origin.
	syncSucceeded bool
	// identifierUnknown is set when the Config read failed. No identifier was seen, which is not the
	// same as none recorded. Choosing a name now could clash with the one already in use.
	identifierUnknown bool
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
		// The ini override gives the data source without the Config. The recorded identifier lives
		// in the Config, so callers must not act on one they cannot see.
		if iniUID != "" {
			return syncTarget{uid: iniUID, origin: originIni, identifierUnknown: true}, nil
		}
		return syncTarget{}, err
	}

	target := syncTarget{uid: externalSyncDatasourceUIDFromConfig(cfg), origin: originAPI}
	if iniUID != "" {
		target = syncTarget{uid: iniUID, origin: originIni}
	}
	if target.uid != "" && cfg != nil {
		target.identifier = recordedSyncIdentifier(&cfg.Status, target.uid)
		target.syncSucceeded = reportsSyncSucceeded(&cfg.Status, target.uid, target.origin)
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

// reportsSyncSucceeded is whether status already says the sync for uid and origin is working, so
// recording another success would change nothing.
func reportsSyncSucceeded(status *alertingnotifv1beta1.ConfigStatus, uid string, origin externalSyncOrigin) bool {
	sync := status.ExternalAlertmanagerSync
	if sync == nil || sync.DatasourceUid == nil || *sync.DatasourceUid != uid || sync.Origin == nil || *sync.Origin != origin {
		return false
	}
	return slices.ContainsFunc(status.Conditions, func(c alertingnotifv1beta1.ConfigCondition) bool {
		return c.Type == conditionTypeExternalAlertmanagerSynced &&
			c.Status == alertingnotifv1beta1.ConfigConditionStatusTrue &&
			c.Reason == conditionReasonSyncSucceeded
	})
}

// ensureSyncIdentifier returns the identifier to import the synced configuration under, choosing and
// recording one first if needed.
//
// The choice is written to Config.status before anything is imported under it, so a later tick can't
// choose a different name (say the datasource was renamed in between) and clash with the import. If
// that write fails, the tick fails too. Importing under another name meanwhile could leave the
// status and the staged import with different names when several instances sync at once.
//
// A sync that already imported under the datasource UID keeps it. Any other sync is named after the
// datasource. When that name is taken or reserved the tick fails instead of picking another one.
func (s *ExternalAMSyncer) ensureSyncIdentifier(ctx context.Context, orgID int64, target syncTarget) (string, error) {
	if target.identifier != "" {
		return target.identifier, nil
	}
	if target.identifierUnknown {
		// A name may be recorded and imported under already. Choosing one now, for example after a
		// rename, could stage a second import. Wait until the Config can be read.
		return "", &SyncError{Reason: ReasonConfigRead, Cause: fmt.Errorf("recorded sync identifier unavailable")}
	}

	raw, err := s.configReader.GetLatestAlertmanagerConfiguration(ctx, orgID)
	if err != nil {
		return "", &SyncError{Reason: ReasonConfigRead, Cause: err}
	}
	amCfg, err := Load([]byte(raw.AlertmanagerConfiguration))
	if err != nil {
		return "", &SyncError{Reason: ReasonConfigRead, Cause: fmt.Errorf("parse alertmanager configuration: %w", err)}
	}

	_, usedByRoute := amCfg.ManagedRoutes[target.uid]
	usedByStaged := slices.ContainsFunc(amCfg.ExtraConfigs, func(ec v1.ExtraConfiguration) bool { return ec.Identifier == target.uid })

	var candidate string
	if usedByRoute || usedByStaged {
		// Imported under the UID before identifiers were recorded. Keep that name so the syncer still
		// recognises its own import.
		candidate = target.uid
	} else {
		ds, err := s.datasourceService.GetDataSource(ctx, &datasources.GetDataSourceQuery{UID: target.uid, OrgID: orgID})
		if err != nil {
			return "", &SyncError{Reason: ReasonDatasourceLookup, Cause: fmt.Errorf("look up datasource: %w", err)}
		}
		candidate = syncIdentifierFromName(ds.Name)
		// Merging rejects a name that a policy tree uses, and the default tree's names are reserved.
		if _, taken := amCfg.ManagedRoutes[candidate]; taken || models.IsDefaultRoutingTreeName(candidate) {
			return "", &SyncError{Reason: ReasonIdentifierTaken, Cause: fmt.Errorf("the name %q, taken from the datasource, is used by a policy tree or reserved: rename the datasource or the policy tree", candidate)}
		}
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
		return "", &SyncError{Reason: ReasonConfigRead, Cause: fmt.Errorf("record sync identifier: %w", err)}
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
	if len(id) > legacy_storage.ManagedRouteNameMaxLength {
		id = strings.TrimRight(id[:legacy_storage.ManagedRouteNameMaxLength], "-")
	}
	if id == "" {
		return fallbackSyncIdentifier
	}
	return id
}
