package models

var (
	ErrPublicDashboardFailedGenerateUniqueUid = DashboardErr{
		Reason:     "Failed to generate unique dashboard id",
		StatusCode: 500,
	}
)

type PublicDashboardConfig struct {
	IsPublic        bool            `json:"isPublic"`
	PublicDashboard PublicDashboard `json:"publicDashboard"`
}

type PublicDashboard struct {
	Uid               string `json:"uid" xorm:"uid"`
	DashboardUid      string `json:"dashboardUid" xorm:"dashboard_uid"`
	OrgId             int64  `json:"orgId" xorm:"org_id"`
	RefreshRate       int64  `json:"refreshRate" xorm:"refresh_rate"`
	TemplateVariables string `json:"templateVariables" xorm:"template_variables"`
	TimeVariables     string `json:"timeVariables" xorm:"time_variables"`
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
