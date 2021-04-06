package api

import "github.com/grafana/grafana/pkg/models"

// updateDashboardACL updates a dashboard's ACL items.
//
// Stubbable by tests.
var updateDashboardACL = func(hs *HTTPServer, dashID int64, items []*models.DashboardAcl) error {
	return hs.SQLStore.UpdateDashboardACL(dashID, items)
}
