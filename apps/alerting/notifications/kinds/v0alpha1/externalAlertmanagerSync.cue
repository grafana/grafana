package v0alpha1

// externalAlertmanagerSync configures syncing the Alertmanager configuration
// from a Mimir/Cortex datasource into the current org. The worker periodically
// fetches the upstream configuration and merges it into the org's Grafana
// alertmanager configuration.
ConfigSpec: externalAlertmanagerSync?: {
	// datasourceUid is the UID of the Mimir/Cortex Alertmanager datasource to
	// sync from. Empty means no sync is configured for the current org. The
	// operator ini setting `unified_alerting.external_alertmanager_uid`
	// overrides this when set; see status.externalAlertmanagerSync.origin.
	datasourceUid?: string
}

// externalAlertmanagerSync mirrors spec with runtime observation.
ConfigStatus: externalAlertmanagerSync?: {
	// datasourceUid is the UID actually used on the last sync attempt; may lag
	// spec until the next tick. When origin=ini, this is the ini override value.
	datasourceUid?: string

	// origin records which source supplied datasourceUid on the last run. "ini"
	// (grafana.ini's unified_alerting.external_alertmanager_uid) wins over "api"
	// (spec.externalAlertmanagerSync.datasourceUid).
	origin?: "api" | "ini"
}
