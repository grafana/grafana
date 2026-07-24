package correlations

import (
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

var (
	// ConfigurationPageAccess is used to protect the "Configure > correlations" tab access
	ConfigurationPageAccess = accesscontrol.EvalPermission(accesscontrol.ActionDatasourcesExplore)
)
