package config

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/validation"
)

// conditionTypeExternalRulerSynced and promotionCommittedReason mirror the
// literal strings the sync worker writes to status.conditions
// (pkg/services/ngalert/rulesync/config_status.go's conditionTypeExternalRulerSynced
// and conditionReasonPromoted). Duplicated rather than imported: this app
// module is a dependency of rulesync, not the other way around, and the
// condition Type/Reason are plain strings with no shared Go type to import
// even if the dependency ran the other way.
const (
	conditionTypeExternalRulerSynced = "ExternalRulerSynced"
	promotionCommittedReason         = "PromotionCommitted"
)

// Config is a per-org singleton, so the only valid name is the well-known
// singleton name. spec.externalRulerSync.datasourceUid is validated only on a
// change to a non-empty UID (clearing is always allowed), delegating to the
// parent-process callback which probes the ruler config API.
//
// promote is a one-way action once committed (status shows
// PromotionCommitted): the sync worker stops managing the promoted rules and
// hands them to the org as freely-editable. Without this check, clearing
// spec.promote back to false would make the worker resume "syncing" — i.e.
// silently reclaim and overwrite whatever the org has since done with those
// rules. That risk only exists while the sync-owned folder is still there:
// if it's gone, a resumed sync just recreates an empty one, so the revert is
// safe to allow.
func ValidateConfigWrite(cfg RuntimeConfig) validation.ValidateFunc[*v0alpha1.Config] {
	return func(ctx context.Context, req validation.Request[*v0alpha1.Config]) error {
		obj := req.Object
		if obj.GetName() != v0alpha1.ConfigSingletonName {
			return fmt.Errorf("kind Config is a singleton; the only valid name is %q", v0alpha1.ConfigSingletonName)
		}

		if newUID, changed := externalRulerSyncUIDChange(obj, req.OldObject); changed && newUID != "" {
			if cfg.ValidateExternalRulerSyncDatasource != nil {
				if err := cfg.ValidateExternalRulerSyncDatasource(ctx, newUID); err != nil {
					return fmt.Errorf("externalRulerSync.datasourceUid: %w", err)
				}
			}
		}

		if promotionCommitted(req.OldObject) && !externalRulerSyncPromote(obj) {
			folderExists := true // fail-safe default: matches this guard's pre-existing unconditional behavior
			if cfg.ExternalRulerSyncFolderExists != nil {
				exists, err := cfg.ExternalRulerSyncFolderExists(ctx, externalRulerSyncStatusUID(req.OldObject))
				if err != nil {
					return fmt.Errorf("externalRulerSync.promote: check sync folder: %w", err)
				}
				folderExists = exists
			}
			if folderExists {
				return fmt.Errorf("externalRulerSync.promote: promotion is a one-way action and cannot be reverted once committed")
			}
		}

		return nil
	}
}

// promotionCommitted reports whether obj's status already shows a committed
// promotion (see the sync worker's ExternalRulerSynced/PromotionCommitted
// condition). false for a nil obj (create).
func promotionCommitted(obj *v0alpha1.Config) bool {
	if obj == nil {
		return false
	}
	for _, c := range obj.Status.Conditions {
		if c.Type == conditionTypeExternalRulerSynced {
			return c.Reason == promotionCommittedReason
		}
	}
	return false
}

// externalRulerSyncStatusUID returns the datasource UID actually used on the
// last sync attempt (status, not spec, which may have since changed). This
// is the UID the sync worker named the canonical folder after, so it's what
// the folder-existence check must use.
func externalRulerSyncStatusUID(c *v0alpha1.Config) string {
	if c == nil || c.Status.ExternalRulerSync == nil || c.Status.ExternalRulerSync.DatasourceUid == nil {
		return ""
	}
	return *c.Status.ExternalRulerSync.DatasourceUid
}

func externalRulerSyncPromote(c *v0alpha1.Config) bool {
	if c == nil || c.Spec.ExternalRulerSync == nil || c.Spec.ExternalRulerSync.Promote == nil {
		return false
	}
	return *c.Spec.ExternalRulerSync.Promote
}

// Returns the new UID and whether it changed. ("", true) on a transition to
// unset (always allowed without validation); ("", false) when both sides are
// empty.
func externalRulerSyncUIDChange(newObj *v0alpha1.Config, oldObj *v0alpha1.Config) (string, bool) {
	newUID := externalRulerSyncUID(newObj)
	oldUID := externalRulerSyncUID(oldObj)
	return newUID, newUID != oldUID
}

func externalRulerSyncUID(c *v0alpha1.Config) string {
	if c == nil || c.Spec.ExternalRulerSync == nil || c.Spec.ExternalRulerSync.DatasourceUid == nil {
		return ""
	}
	return *c.Spec.ExternalRulerSync.DatasourceUid
}
