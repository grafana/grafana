package alerting

import (
	"github.com/grafana/grafana/pkg/services/provisioning/values"
)

type configVersion struct {
	APIVersion values.Int64Value `json:"apiVersion" yaml:"apiVersion"`
}

type AlertingFile struct {
	configVersion
	Groups              []AlertRuleGroup
	DeleteRules         []RuleDelete
	ContactPoints       []ContactPoint
	DeleteContactPoints []DeleteContactPointV1
}

type AlertingFileV1 struct {
	configVersion
	Groups              []AlertRuleGroupV1     `json:"groups" yaml:"groups"`
	DeleteRules         []RuleDeleteV1         `json:"deleteRules" yaml:"deleteRules"`
	ContactPoints       []ContactPointV1       `json:"contactPoints" yaml:"contactPoints"`
	DeleteContactPoints []DeleteContactPointV1 `json:"deleteContactPoints" yaml:"deleteContactPoints"`
}

func (fileV1 *AlertingFileV1) MapToModel() (AlertingFile, error) {
	alertingFile := AlertingFile{}
	err := fileV1.mapRules(&alertingFile)
	if err != nil {
		return AlertingFile{}, err
	}
	err = fileV1.mapContactPoint(&alertingFile)
	if err != nil {
		return AlertingFile{}, err
	}
	return alertingFile, nil
}

func (fileV1 *AlertingFileV1) mapContactPoint(alertingFile *AlertingFile) error {
	alertingFile.DeleteContactPoints = fileV1.DeleteContactPoints
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
		ruleDelete := RuleDelete{
			UID:   ruleDeleteV1.UID.Value(),
			OrgID: orgID,
		}
		alertingFile.DeleteRules = append(alertingFile.DeleteRules, ruleDelete)
	}
	return nil
}
