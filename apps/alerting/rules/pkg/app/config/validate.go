package config

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/validation"
)

// ValidateConfigWrite is the admission validator for the Config kind. Config is
// a per-org singleton, so the only valid name is the well-known singleton name.
// spec.externalRulerSync.datasourceUid is validated only on a change to a
// non-empty UID (clearing is always allowed), delegating to the parent-process
// callback which probes the ruler config API.
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

		return nil
	}
}

// externalRulerSyncUIDChange returns the proposed UID and whether it differs
// from the prior value. ("", true) on a transition to unset (always allowed
// without validation); ("", false) when both sides are empty.
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
