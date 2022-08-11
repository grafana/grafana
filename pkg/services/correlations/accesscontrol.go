package correlations

import (
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/datasources"
)

var (
	// ConfigurationPageAccess is used to protect the "Configure > correlations" tab access
	ConfigurationPageAccess = accesscontrol.EvalPermission(datasources.ActionRead)
)
