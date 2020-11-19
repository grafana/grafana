package dtos

import "github.com/grafana/grafana/pkg/models"

// DashboardByUIDParams A DashboardByUID parameter model
//
// This is used for operations that want the UID of a dashboard in the path
// swagger:parameters getDashboardByUID deleteDashboardByUID
type DashboardByUIDParams struct {
	// The unique identifier (uid) of a dashboard can be used for uniquely identify a dashboard between multiple Grafana installs.
	// It’s automatically generated if not provided when creating a dashboard. The uid allows having consistent URL’s for accessing
	// dashboards and when syncing dashboards between multiple Grafana installs. This means that changing the title of a dashboard
	// will not break any bookmarked links to that dashboard.
	//
	// in: path
	// maximumLength: 40
	// required: true
	UID string `json:"uid"`
}

// DashboardBySlugParams A DashboardBySlug parameter model
//
// This is used for operations that want the slug of a dashboard in the path
// swagger:parameters getDashboardBySlug deleteDashboardBySlug
type DashboardBySlugParams struct {
	// The slug of the dashboard
	//
	// in: path
	// required: true
	Slug string `json:"slug"`
}

// swagger:parameters postDashboard
type PostDashboardParams struct {
	// in: body
	Body models.SaveDashboardCommand `json:"body"`
}
