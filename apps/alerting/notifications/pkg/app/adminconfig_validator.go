package app

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"

	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v0alpha1"
)

// newAdminConfigValidator returns the admission validator for AdminConfig. Per
// feature, it dispatches to the matching validator function on Config —
// externalAlertmanagerSync's datasourceUid is validated via
// cfg.ValidateExternalSyncDatasource, which is implemented in the parent
// process (pkg/registry/apps/alerting/notifications) where it has access to
// the datasource service, feature flag client, and namespace→orgID mapping.
//
// When the per-feature validator is nil (test paths), the corresponding check
// is skipped rather than failing closed — the validator should only reject
// inputs we can affirmatively prove are invalid.
func newAdminConfigValidator(cfg *Config) *simple.Validator {
	return &simple.Validator{
		ValidateFunc: func(ctx context.Context, req *app.AdmissionRequest) error {
			obj, ok := req.Object.(*v0alpha1.AdminConfig)
			if !ok {
				return fmt.Errorf("object is not *v0alpha1.AdminConfig")
			}

			// externalAlertmanagerSync.datasourceUid:
			// only validate when actually changing — empty/unset is always
			// allowed (clears the per-org config); only validate when the
			// admin is setting a non-empty UID AND it differs from the
			// current persisted value, so unrelated edits don't fail when
			// the previously-stored UID is no longer valid.
			if newUID, changed := externalSyncUIDChange(obj, req.OldObject); changed && newUID != "" {
				if cfg.ValidateExternalSyncDatasource != nil {
					if err := cfg.ValidateExternalSyncDatasource(ctx, newUID); err != nil {
						return fmt.Errorf("externalAlertmanagerSync.datasourceUid: %w", err)
					}
				}
			}

			return nil
		},
	}
}

// externalSyncUIDChange extracts the proposed UID from obj and returns
// whether it differs from the prior value on oldObj. Returns ("", false)
// when both sides are unset/empty, ("uid", true) when set or changed,
// ("", true) when transitioning to unset (a delete-by-omit pattern, which
// is always allowed without validation).
func externalSyncUIDChange(newObj *v0alpha1.AdminConfig, oldObj any) (string, bool) {
	newUID := uidFromAdminConfig(newObj)
	oldUID := uidFromAdminConfig(asAdminConfig(oldObj))
	return newUID, newUID != oldUID
}

func uidFromAdminConfig(c *v0alpha1.AdminConfig) string {
	if c == nil || c.Spec.ExternalAlertmanagerSync == nil || c.Spec.ExternalAlertmanagerSync.DatasourceUid == nil {
		return ""
	}
	return *c.Spec.ExternalAlertmanagerSync.DatasourceUid
}

func asAdminConfig(o any) *v0alpha1.AdminConfig {
	if o == nil {
		return nil
	}
	cfg, _ := o.(*v0alpha1.AdminConfig)
	return cfg
}
