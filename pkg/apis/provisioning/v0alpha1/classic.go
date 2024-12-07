package v0alpha1

// File types used from classic provisioning
// +enum
type ClassicFileType string

const (
	// Dashboard JSON
	ClassicDashboard ClassicFileType = "dashboard"

	// Datasource definitions
	// eg: https://github.com/grafana/grafana/blob/v11.3.1/conf/provisioning/datasources/sample.yaml
	ClassicDatasources ClassicFileType = "datasources"

	// Alert configuration
	// https://github.com/grafana/grafana/blob/v11.3.1/conf/provisioning/alerting/sample.yaml
	ClassicAlerting ClassicFileType = "alerting"

	// Access control
	// https://github.com/grafana/grafana/blob/v11.3.1/conf/provisioning/access-control/sample.yaml
	ClassicAccessControl ClassicFileType = "access-control"
)
