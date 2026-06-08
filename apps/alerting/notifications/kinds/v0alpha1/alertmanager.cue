package v0alpha1

// AlertmanagerSpec groups admin config for the current org's Alertmanager.
#AlertmanagerSpec: {
	// externalSync configures syncing the Alertmanager configuration from a
	// Mimir/Cortex datasource into the current org. The worker periodically
	// fetches the upstream configuration and merges it into the current org's
	// Grafana alertmanager configuration.
	externalSync?: {
		// datasourceUid is the UID of the Mimir/Cortex Alertmanager datasource
		// to sync from. Empty means no sync is configured for the current org.
		// The operator ini setting `unified_alerting.external_alertmanager_uid`
		// overrides this when set; see status.alertmanager.externalSync.origin.
		datasourceUid?: string
	}
}

// AlertmanagerStatus mirrors #AlertmanagerSpec with runtime observation.
#AlertmanagerStatus: {
	externalSync?: {
		// datasourceUid is the UID actually used on the last sync attempt; may
		// lag spec until the next tick. When origin=ini, this is the ini
		// override value.
		datasourceUid?: string

		// origin records which source supplied datasourceUid on the last run.
		// "ini" (grafana.ini's unified_alerting.external_alertmanager_uid) wins
		// over "api" (spec.alertmanager.externalSync.datasourceUid).
		origin?: "api" | "ini"
	}
}
