package brokenpanels

import (
	"context"

	"github.com/grafana/grafana/pkg/services/dashboards"
)

// Service is a service for finding broken panels in dashboards.
//
//go:generate mockery --name Service --structname FakeBrokenPanelsService --inpackage --filename service_mock.go
type Service interface {
	// FindBrokenPanels finds all broken panels in a specific dashboard
	FindBrokenPanels(ctx context.Context, query *FindBrokenPanelsQuery) (*BrokenPanelsResult, error)

	// FindBrokenPanelsInOrg finds all broken panels across all dashboards in an organization
	FindBrokenPanelsInOrg(ctx context.Context, query *FindBrokenPanelsInOrgQuery) (*BrokenPanelsResult, error)

	// ValidatePanel validates if a specific panel is broken
	ValidatePanel(ctx context.Context, query *ValidatePanelQuery) (*PanelValidationResult, error)

	// InvalidateDashboardCache invalidates cache for a specific dashboard
	InvalidateDashboardCache(ctx context.Context, dashboardUID string, orgID int64)

	// InvalidateOrgCache invalidates cache for an organization
	InvalidateOrgCache(ctx context.Context, orgID int64)

	// ClearAll clears all broken panels cache
	ClearAll(ctx context.Context)
}

// Store is a broken panels store.
//
//go:generate mockery --name Store --structname FakeBrokenPanelsStore --inpackage --filename store_mock.go
type Store interface {
	// GetDashboardsWithBrokenPanels retrieves dashboards that contain broken panels
	GetDashboardsWithBrokenPanels(ctx context.Context, query *GetDashboardsWithBrokenPanelsQuery) ([]*DashboardWithBrokenPanels, error)
}

// FindBrokenPanelsQuery represents a query to find broken panels in a specific dashboard
type FindBrokenPanelsQuery struct {
	DashboardUID string
	OrgID        int64
}

// FindBrokenPanelsInOrgQuery represents a query to find broken panels across all dashboards in an organization
type FindBrokenPanelsInOrgQuery struct {
	OrgID int64
	// Optional filters
	DashboardUIDs []string
	PanelTypes    []string
	ErrorTypes    []string
}

// ValidatePanelQuery represents a query to validate a specific panel
type ValidatePanelQuery struct {
	Dashboard *dashboards.Dashboard
	PanelID   int64
	OrgID     int64
}

// GetDashboardsWithBrokenPanelsQuery represents a query to get dashboards with broken panels
type GetDashboardsWithBrokenPanelsQuery struct {
	OrgID int64
	// Optional filters
	DashboardUIDs []string
	ErrorTypes    []string
}

// BrokenPanelsResult represents the result of finding broken panels
type BrokenPanelsResult struct {
	DashboardUID   string
	DashboardTitle string
	BrokenPanels   []*BrokenPanel
	TotalCount     int
}

// DashboardWithBrokenPanels represents a dashboard that contains broken panels
type DashboardWithBrokenPanels struct {
	DashboardUID     string
	DashboardTitle   string
	BrokenPanelCount int
	BrokenPanels     []*BrokenPanel
}

// BrokenPanel represents a broken panel with details about the issue
type BrokenPanel struct {
	PanelID      int64
	PanelTitle   string
	PanelType    string
	ErrorType    string
	ErrorMessage string
	Datasource   *DatasourceInfo
	Position     *PanelPosition
}

// PanelValidationResult represents the result of validating a specific panel
type PanelValidationResult struct {
	PanelID      int64
	IsBroken     bool
	ErrorType    string
	ErrorMessage string
	Datasource   *DatasourceInfo
}

// DatasourceInfo represents information about a datasource
type DatasourceInfo struct {
	UID  string
	Type string
	Name string
}

// PanelPosition represents the position of a panel in the dashboard
type PanelPosition struct {
	X int
	Y int
	W int
	H int
}

// Error types for broken panels
const (
	ErrorTypeDatasourceNotFound     = "datasource_not_found"
	ErrorTypeDatasourceAccessDenied = "datasource_access_denied"
	ErrorTypePluginNotFound         = "plugin_not_found"
	ErrorTypePluginVersionMismatch  = "plugin_version_mismatch"
	ErrorTypeInvalidQuery           = "invalid_query"
	ErrorTypeMissingTargets         = "missing_targets"
	ErrorTypeInvalidConfiguration   = "invalid_configuration"
)
