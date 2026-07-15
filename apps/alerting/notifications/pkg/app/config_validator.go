package app

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v0alpha1"
)

// newConfigValidator returns the admission validator for Config. Per feature, it
// dispatches to the matching validator function — externalAlertmanagerSync's
// datasourceUid is validated via cfg.ValidateExternalSyncDatasource, which is
// implemented in the parent process (pkg/registry/apps/alerting/notifications)
// where it has access to the datasource service, feature flag client, and
// namespace→orgID mapping. cfg.ValidateExternalSyncDatasource is required
// (enforced by Config.Validate).
func newConfigValidator(cfg *Config) *simple.Validator {
	return &simple.Validator{
		ValidateFunc: func(ctx context.Context, req *app.AdmissionRequest) error {
			obj, ok := req.Object.(*v0alpha1.Config)
			if !ok {
				return fmt.Errorf("object is not *v0alpha1.Config")
			}

			// Config is a per-org singleton: the only valid name is the
			// well-known singleton name. Reject anything else so the resource
			// can't be fanned out into multiple per-org documents.
			if obj.GetName() != v0alpha1.ConfigSingletonName {
				return fmt.Errorf("Config is a singleton; the only valid name is %q", v0alpha1.ConfigSingletonName)
			}

			// externalAlertmanagerSync.datasourceUid: validate only on a change to
			// a non-empty UID. Clearing is always allowed (also while the ini
			// override is set, so a dormant value can be removed); a no-op replay
			// (e.g. a GitOps reconcile) is allowed too, since it can't introduce a
			// new dormant value.
			if newUID, changed := externalSyncUIDChange(obj, req.OldObject); changed && newUID != "" {
				if err := cfg.ValidateExternalSyncDatasource(ctx, newUID); err != nil {
					return fmt.Errorf("externalAlertmanagerSync.datasourceUid: %w", err)
				}
			}

			// autogenRouteTimings: reject unparseable durations. We deliberately do
			// not enforce repeat_interval > group_interval (unenforced elsewhere too).
			if err := validateAutogenRouteTimings(obj); err != nil {
				return err
			}

			return nil
		},
	}
}

// validateAutogenRouteTimings checks that every set value in
// spec.autogenRouteTimings parses as a Prometheus duration. Unset/empty is valid.
func validateAutogenRouteTimings(obj *v0alpha1.Config) error {
	t := obj.Spec.AutogenRouteTimings
	if t == nil {
		return nil
	}
	for _, f := range []struct {
		name  string
		value *string
	}{
		{"group_wait", t.GroupWait},
		{"group_interval", t.GroupInterval},
		{"repeat_interval", t.RepeatInterval},
	} {
		if f.value == nil || *f.value == "" {
			continue
		}
		if _, err := model.ParseDuration(*f.value); err != nil {
			return fmt.Errorf("autogenRouteTimings.%s: invalid duration %q: %w", f.name, *f.value, err)
		}
	}
	return nil
}

// externalSyncUIDChange extracts the proposed UID from obj and returns
// whether it differs from the prior value on oldObj. Returns ("", false)
// when both sides are unset/empty, ("uid", true) when set or changed,
// ("", true) when transitioning to unset (a delete-by-omit pattern, which
// is always allowed without validation).
func externalSyncUIDChange(newObj *v0alpha1.Config, oldObj any) (string, bool) {
	newUID := uidFromConfig(newObj)
	oldUID := uidFromConfig(asConfig(oldObj))
	return newUID, newUID != oldUID
}

func uidFromConfig(c *v0alpha1.Config) string {
	if c == nil || c.Spec.ExternalAlertmanagerSync == nil || c.Spec.ExternalAlertmanagerSync.DatasourceUid == nil {
		return ""
	}
	return *c.Spec.ExternalAlertmanagerSync.DatasourceUid
}

func asConfig(o any) *v0alpha1.Config {
	if o == nil {
		return nil
	}
	cfg, _ := o.(*v0alpha1.Config)
	return cfg
}
