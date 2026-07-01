package v0alpha1

// externalRulerSync configures syncing alert rules from a Mimir/Cortex
// Prometheus (ruler) datasource into the current org. The worker periodically
// fetches the upstream rule groups and imports them into Grafana as
// converted-Prometheus rules.
ConfigSpec: {
	externalRulerSync?: {
		// datasourceUid is the UID of the Mimir/Cortex Prometheus datasource to
		// sync alert rules from. Empty means no sync is configured for the current
		// org. The operator ini setting `unified_alerting.external_ruler_uid`
		// overrides this when set; see status.externalRulerSync.origin.
		datasourceUid?: string
	}
}

// externalRulerSync mirrors spec with runtime observation.
ConfigStatus: {
	externalRulerSync?: {
		// datasourceUid is the UID actually used on the last sync attempt; may lag
		// spec until the next tick. When origin=ini, this is the ini override value.
		datasourceUid?: string

		// origin records which source supplied datasourceUid on the last run. "ini"
		// (grafana.ini's unified_alerting.external_ruler_uid) wins over "api"
		// (spec.externalRulerSync.datasourceUid).
		origin?: "api" | "ini"
	}
}
