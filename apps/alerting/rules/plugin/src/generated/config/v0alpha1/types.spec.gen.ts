// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export interface Spec {
	externalRulerSync?: {
		// datasourceUid is the UID of the Mimir/Cortex Prometheus datasource to
		// sync alert rules from. Empty means no sync is configured for the current
		// org. The operator ini setting `unified_alerting.external_ruler_uid`
		// overrides this when set; see status.externalRulerSync.origin.
		datasourceUid?: string;
		// targetDatasourceUid is the UID of the datasource that converted recording
		// rules write their results to. Empty defaults to datasourceUid (the query
		// datasource). Only used when the upstream ruler contains recording rules.
		// Has no effect on the operator ini path, which always targets the query
		// datasource.
		targetDatasourceUid?: string;
		// pollInterval sets how often this org's rules are re-synced from
		// datasourceUid. Empty defaults to 1m. The worker checks orgs against a
		// short internal baseline and only does real work for an org once its own
		// pollInterval has elapsed, so this is a lower bound, not a guarantee —
		// an org's actual sync can lag slightly past its configured interval. Has
		// no effect on the operator ini path, which always uses the 1m default.
		pollInterval?: string;
	};
}

export const defaultSpec = (): Spec => ({
});

