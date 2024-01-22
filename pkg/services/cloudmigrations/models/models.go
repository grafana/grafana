package models

type MigrateDatasourcesRequest struct {
	MigrateToPDC bool
}

type MigrateDatasourcesResponse struct {
	DashboardsMigrated int
}
