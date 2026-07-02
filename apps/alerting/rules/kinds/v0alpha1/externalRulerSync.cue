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

		// targetDatasourceUid is the UID of the datasource that converted recording
		// rules write their results to. Empty defaults to datasourceUid (the query
		// datasource). Only used when the upstream ruler contains recording rules.
		targetDatasourceUid?: string

		// promote, when true, converts the rules already synced from datasourceUid
		// into native Grafana rules the org owns (provenance is cleared so they
		// become editable) and stops syncing them. This is a one-way action: once
		// promoted the worker no longer manages these rules. Ignored while the
		// operator ini override `unified_alerting.external_ruler_uid` is set.
		promote?: bool
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
