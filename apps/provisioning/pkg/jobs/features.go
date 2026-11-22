package jobs

// Feature flags the job workers check. They are registered in the main Grafana
// module's featuremgmt package, which this package must not import.
const (
	FlagProvisioningExport      = "provisioningExport"
	FlagProvisioningPerformance = "provisioning.performance"
)
