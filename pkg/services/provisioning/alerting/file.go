package alerting

import (
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/provisioning/values"
)

const (
	apiVersion1 = 1
	apiVersion2 = 2
)

type configVersion struct {
	APIVersion values.Int64Value `json:"apiVersion" yaml:"apiVersion"`
}

type OrgID int64

// AlertingFile is the format that is consumed by the rules provisioner.
type AlertingFile struct {
	configVersion
	Filename            string
	Groups              []models.AlertRuleGroupWithFolderTitle
	DeleteRules         []RuleDelete
	ContactPoints       []ContactPoint
	DeleteContactPoints []DeleteContactPoint
	Policies            []NotificiationPolicy
	ResetPolicies       []OrgID
	MuteTimes           []MuteTime
	DeleteMuteTimes     []DeleteMuteTime
	Templates           []Template
	DeleteTemplates     []DeleteTemplate
}
