package v0alpha1

// AdminConfig is the per-org alerting admin config — a singleton resource
// carrying admin-controllable settings for the alerting stack.
//
// Spec is a flat collection of independent, optional feature sub-objects.
// Each feature carries its own typed config; siblings can be extracted to
// separate kinds later without disturbing the rest.
AdminConfigSpec: {
	// externalAlertmanagerSync configures the per-org external Alertmanager
	// configuration sync worker. The worker periodically fetches the
	// alertmanager configuration from a Mimir/Cortex datasource and merges
	// it into the org's local alertmanager configuration.
	externalAlertmanagerSync?: {
		// datasourceUid is the UID of the Mimir/Cortex Alertmanager
		// datasource to sync from. Empty means no per-org sync configured.
		// The operator ini setting `unified_alerting.external_alertmanager_uid`
		// overrides this when set; see status.externalAlertmanagerSync.origin.
		datasourceUid?: string
	}
}
