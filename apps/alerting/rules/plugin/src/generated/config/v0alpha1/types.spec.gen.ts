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
		targetDatasourceUid?: string;
		// promote, when true, converts the rules already synced from datasourceUid
		// into native Grafana rules the org owns (provenance is cleared so they
		// become editable) and stops syncing them. This is a one-way action: once
		// promoted the worker no longer manages these rules. Ignored while the
		// operator ini override `unified_alerting.external_ruler_uid` is set.
		promote?: boolean;
	};
}

export const defaultSpec = (): Spec => ({
});

