package models

var (
	ErrPublicDashboardFailedGenerateUniqueUid = DashboardErr{
		Reason:     "Failed to generate unique dashboard id",
		StatusCode: 500,
	}
)

type PublicDashboardConfig struct {
	IsPublic         bool `json:"isPublic"`
	PublicDashboards []*PublicDashboard
}

type PublicDashboard struct {
	Uid               string
	DashboardUid      string
	OrgId             string
	RefreshRate       int64
	TemplateVariables string
	TimeVariables     string
}

func (pd PublicDashboard) TableName() string {
	return "dashboard_public_config"
}

//
// COMMANDS
//

type SavePublicDashboardConfigCommand struct {
	Uid                   string
	OrgId                 int64
	PublicDashboardConfig PublicDashboardConfig
}
