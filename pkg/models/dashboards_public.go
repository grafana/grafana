package models

var (
	ErrPublicDashboardFailedGenerateUniqueUid = DashboardErr{
		Reason:     "Failed to generate unique dashboard id",
		StatusCode: 500,
	}
	ErrPublicDashboardNotFound = DashboardErr{
		Reason:     "Public dashboard not found",
		StatusCode: 404,
		Status:     "not-found",
	}
	ErrPublicDashboardIdentifierNotSet = DashboardErr{
		Reason:     "No Uid for public dashboard specified",
		StatusCode: 400,
	}
)

type PublicDashboardConfig struct {
	IsPublic        bool            `json:"isPublic"`
	PublicDashboard PublicDashboard `json:"publicDashboard"`
}

type PublicDashboard struct {
	Uid          string `json:"uid" xorm:"uid"`
	DashboardUid string `json:"dashboardUid" xorm:"dashboard_uid"`
	OrgId        int64  `json:"orgId" xorm:"org_id"`
	TimeSettings string `json:"timeSettings" xorm:"time_settings"`
}

func (pd PublicDashboard) TableName() string {
	return "dashboard_public_config"
}

//
// COMMANDS
//

type SavePublicDashboardConfigCommand struct {
	DashboardUid          string
	OrgId                 int64
	PublicDashboardConfig PublicDashboardConfig
}
