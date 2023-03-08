package alerting

import (
	"fmt"

	"github.com/grafana/grafana/pkg/services/provisioning/alerting/file"
	"github.com/grafana/grafana/pkg/services/provisioning/values"
)

type configVersion struct {
	APIVersion values.Int64Value `json:"apiVersion" yaml:"apiVersion"`
}

type OrgID int64

type AlertingFile struct {
	configVersion
	Filename            string
	Groups              []file.AlertRuleGroupWithFolderTitle
	DeleteRules         []file.RuleDelete
	ContactPoints       []ContactPoint
	DeleteContactPoints []DeleteContactPoint
	Policies            []NotificiationPolicy
	ResetPolicies       []OrgID
	MuteTimes           []MuteTime
	DeleteMuteTimes     []DeleteMuteTime
	Templates           []Template
	DeleteTemplates     []DeleteTemplate
}

type AlertingFileV1 struct {
	configVersion
	Filename            string
	Groups              []file.AlertRuleGroupV1 `json:"groups" yaml:"groups"`
	DeleteRules         []file.RuleDeleteV1     `json:"deleteRules" yaml:"deleteRules"`
	ContactPoints       []ContactPointV1        `json:"contactPoints" yaml:"contactPoints"`
	DeleteContactPoints []DeleteContactPointV1  `json:"deleteContactPoints" yaml:"deleteContactPoints"`
	Policies            []NotificiationPolicyV1 `json:"policies" yaml:"policies"`
	ResetPolicies       []values.Int64Value     `json:"resetPolicies" yaml:"resetPolicies"`
	MuteTimes           []MuteTimeV1            `json:"muteTimes" yaml:"muteTimes"`
	DeleteMuteTimes     []DeleteMuteTimeV1      `json:"deleteMuteTimes" yaml:"deleteMuteTimes"`
	Templates           []TemplateV1            `json:"templates" yaml:"templates"`
	DeleteTemplates     []DeleteTemplateV1      `json:"deleteTemplates" yaml:"deleteTemplates"`
}

func (fileV1 *AlertingFileV1) MapToModel() (AlertingFile, error) {
	alertingFile := AlertingFile{}
	alertingFile.Filename = fileV1.Filename
	if err := fileV1.mapRules(&alertingFile); err != nil {
		return AlertingFile{}, fmt.Errorf("failure parsing rules: %w", err)
	}
	if err := fileV1.mapContactPoint(&alertingFile); err != nil {
		return AlertingFile{}, fmt.Errorf("failure parsing contact points: %w", err)
	}
	if err := fileV1.mapPolicies(&alertingFile); err != nil {
		return AlertingFile{}, fmt.Errorf("failure parsing policies: %w", err)
	}
	if err := fileV1.mapMuteTimes(&alertingFile); err != nil {
		return AlertingFile{}, fmt.Errorf("failure parsing mute times: %w", err)
	}
	if err := fileV1.mapTemplates(&alertingFile); err != nil {
		return AlertingFile{}, fmt.Errorf("failure parsing templates: %w", err)
	}
	return alertingFile, nil
}

func (fileV1 *AlertingFileV1) mapTemplates(alertingFile *AlertingFile) error {
	for _, ttV1 := range fileV1.Templates {
		alertingFile.Templates = append(alertingFile.Templates, ttV1.mapToModel())
	}
	for _, deleteV1 := range fileV1.DeleteTemplates {
		delReq, err := deleteV1.mapToModel()
		if err != nil {
			return err
		}
		alertingFile.DeleteTemplates = append(alertingFile.DeleteTemplates, delReq)
	}
	return nil
}

func (fileV1 *AlertingFileV1) mapMuteTimes(alertingFile *AlertingFile) error {
	for _, mtV1 := range fileV1.MuteTimes {
		alertingFile.MuteTimes = append(alertingFile.MuteTimes, mtV1.mapToModel())
	}
	for _, deleteV1 := range fileV1.DeleteMuteTimes {
		delReq, err := deleteV1.mapToModel()
		if err != nil {
			return err
		}
		alertingFile.DeleteMuteTimes = append(alertingFile.DeleteMuteTimes, delReq)
	}
	return nil
}

func (fileV1 *AlertingFileV1) mapPolicies(alertingFile *AlertingFile) error {
	for _, npV1 := range fileV1.Policies {
		np, err := npV1.mapToModel()
		if err != nil {
			return err
		}
		alertingFile.Policies = append(alertingFile.Policies, np)
	}
	for _, orgIDV1 := range fileV1.ResetPolicies {
		alertingFile.ResetPolicies = append(alertingFile.ResetPolicies, OrgID(orgIDV1.Value()))
	}
	return nil
}

func (fileV1 *AlertingFileV1) mapContactPoint(alertingFile *AlertingFile) error {
	for _, dcp := range fileV1.DeleteContactPoints {
		alertingFile.DeleteContactPoints = append(alertingFile.DeleteContactPoints, dcp.MapToModel())
	}
	for _, contactPointV1 := range fileV1.ContactPoints {
		contactPoint, err := contactPointV1.MapToModel()
		if err != nil {
			return err
		}
		alertingFile.ContactPoints = append(alertingFile.ContactPoints, contactPoint)
	}
	return nil
}

func (fileV1 *AlertingFileV1) mapRules(alertingFile *AlertingFile) error {
	for _, groupV1 := range fileV1.Groups {
		group, err := groupV1.MapToModel()
		if err != nil {
			return err
		}
		alertingFile.Groups = append(alertingFile.Groups, group)
	}
	for _, ruleDeleteV1 := range fileV1.DeleteRules {
		orgID := ruleDeleteV1.OrgID.Value()
		if orgID < 1 {
			orgID = 1
		}
		ruleDelete := file.RuleDelete{
			UID:   ruleDeleteV1.UID.Value(),
			OrgID: orgID,
		}
		alertingFile.DeleteRules = append(alertingFile.DeleteRules, ruleDelete)
	}
	return nil
}
