package v0alpha1

// AlertingConfig is the per-org alerting admin config — a singleton resource
// carrying admin-controllable settings for the alerting stack.
//
// Spec is structured as a flat collection of independent, optional feature
// sub-objects. Each feature carries its own typed configuration. Future
// features land as sibling sub-objects; if any one feature grows so large
// or write-contentious that it needs its own kind, the sub-object is
// trivially extracted because it has no structural entanglement with the
// rest.
AlertingConfigSpec: {
	// externalAlertmanagerSync configures the per-org external Alertmanager
	// configuration sync worker. The worker fetches the alertmanager
	// configuration from a Mimir/Cortex datasource and merges it into the
	// org's local alertmanager configuration on each MAM sync tick.
	externalAlertmanagerSync?: {
		// datasourceUid is the UID of the Mimir/Cortex Alertmanager
		// datasource to sync configuration from. Empty (omitted) means
		// no per-org sync is configured. The operator-level
		// unified_alerting.external_alertmanager_uid ini setting still
		// wins over this when set — runtime observation of which source
		// is active lives on the status sub-object (origin field).
		datasourceUid?: string
	}
}
