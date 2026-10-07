package app

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"

	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v1beta1"
)

// newConfigValidator returns the admission validator for Config. Per feature, it
// dispatches to the matching validator function — externalAlertmanagerSync's
// datasourceUid is validated via cfg.ValidateExternalSyncDatasource, which is
// implemented in the parent process (pkg/registry/apps/alerting/notifications)
// where it has access to the datasource service, feature flag client, and
// namespace→orgID mapping. cfg.ValidateExternalSyncDatasource is required
// (enforced by Config.Validate).
//
// The same validator is attached to every served version of the kind, so it
// works off a version-independent view of the object.
func newConfigValidator(cfg *Config) *simple.Validator {
	return &simple.Validator{
		ValidateFunc: func(ctx context.Context, req *app.AdmissionRequest) error {
			obj, ok := asConfigView(req.Object)
			if !ok {
				return fmt.Errorf("object is not a Config")
			}

			// Config is a per-org singleton: the only valid name is the
			// well-known singleton name. Reject anything else so the resource
			// can't be fanned out into multiple per-org documents.
			if obj.name != v1beta1.ConfigSingletonName {
				return fmt.Errorf("Config is a singleton; the only valid name is %q", v1beta1.ConfigSingletonName)
			}

			// externalAlertmanagerSync.datasourceUid: validate only on a change to
			// a non-empty UID. Clearing is always allowed (also while the ini
			// override is set, so a dormant value can be removed); a no-op replay
			// (e.g. a GitOps reconcile) is allowed too, since it can't introduce a
			// new dormant value.
			old, _ := asConfigView(req.OldObject)
			if newUID := obj.externalSyncUID; newUID != "" && newUID != old.externalSyncUID {
				if err := cfg.ValidateExternalSyncDatasource(ctx, newUID); err != nil {
					return fmt.Errorf("externalAlertmanagerSync.datasourceUid: %w", err)
				}
			}

			return nil
		},
	}
}

// configView carries the fields the validator reads, extracted from whichever
// served version the request arrived as. Both versions share a schema, so a
// missing object collapses to the zero view (empty name and UID).
type configView struct {
	name            string
	externalSyncUID string
}

func asConfigView(o any) (configView, bool) {
	switch c := o.(type) {
	case *v0alpha1.Config:
		if c == nil {
			return configView{}, false
		}
		v := configView{name: c.GetName()}
		if s := c.Spec.ExternalAlertmanagerSync; s != nil && s.DatasourceUid != nil {
			v.externalSyncUID = *s.DatasourceUid
		}
		return v, true
	case *v1beta1.Config:
		if c == nil {
			return configView{}, false
		}
		v := configView{name: c.GetName()}
		if s := c.Spec.ExternalAlertmanagerSync; s != nil && s.DatasourceUid != nil {
			v.externalSyncUID = *s.DatasourceUid
		}
		return v, true
	}
	return configView{}, false
}
