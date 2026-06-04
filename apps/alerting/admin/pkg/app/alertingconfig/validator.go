package alertingconfig

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"

	"github.com/grafana/grafana/apps/alerting/admin/pkg/apis/alertingadmin/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/admin/pkg/app/config"
)

// NewValidator returns the admission validator for AlertingConfig. Per
// feature, it dispatches to the matching validator function on
// config.RuntimeConfig — externalAlertmanagerSync's datasourceUid is
// validated via cfg.ValidateExternalSyncDatasource, which is implemented
// in the parent process (pkg/registry/apps/alerting/admin/register.go)
// where it has access to the datasource service, feature flag client,
// and namespace→orgID mapping.
//
// When the per-feature validator is nil (test paths), the corresponding
// check is skipped rather than failing closed — the validator should only
// reject inputs we can affirmatively prove are invalid.
func NewValidator(cfg config.RuntimeConfig) *simple.Validator {
	return &simple.Validator{
		ValidateFunc: func(ctx context.Context, req *app.AdmissionRequest) error {
			obj, ok := req.Object.(*v0alpha1.AlertingConfig)
			if !ok {
				return fmt.Errorf("object is not *v0alpha1.AlertingConfig")
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
func externalSyncUIDChange(newObj *v0alpha1.AlertingConfig, oldObj any) (string, bool) {
	newUID := uidFromConfig(newObj)
	oldUID := uidFromConfig(asAlertingConfig(oldObj))
	return newUID, newUID != oldUID
}

func uidFromConfig(c *v0alpha1.AlertingConfig) string {
	if c == nil || c.Spec.ExternalAlertmanagerSync == nil || c.Spec.ExternalAlertmanagerSync.DatasourceUid == nil {
		return ""
	}
	return *c.Spec.ExternalAlertmanagerSync.DatasourceUid
}

func asAlertingConfig(o any) *v0alpha1.AlertingConfig {
	if o == nil {
		return nil
	}
	cfg, _ := o.(*v0alpha1.AlertingConfig)
	return cfg
}
