package alerting

import (
	"fmt"

	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/provisioning/values"
)

type AlertingFileV2 struct {
	configVersion
	Filename            string
	Groups              []AlertRuleGroupV2      `json:"groups" yaml:"groups"`
	DeleteRules         []RuleDeleteV1          `json:"deleteRules" yaml:"deleteRules"`
	ContactPoints       []ContactPointV1        `json:"contactPoints" yaml:"contactPoints"`
	DeleteContactPoints []DeleteContactPointV1  `json:"deleteContactPoints" yaml:"deleteContactPoints"`
	Policies            []NotificiationPolicyV1 `json:"policies" yaml:"policies"`
	ResetPolicies       []values.Int64Value     `json:"resetPolicies" yaml:"resetPolicies"`
	MuteTimes           []MuteTimeV1            `json:"muteTimes" yaml:"muteTimes"`
	DeleteMuteTimes     []DeleteMuteTimeV1      `json:"deleteMuteTimes" yaml:"deleteMuteTimes"`
	Templates           []TemplateV1            `json:"templates" yaml:"templates"`
	DeleteTemplates     []DeleteTemplateV1      `json:"deleteTemplates" yaml:"deleteTemplates"`
}

func (fileV2 *AlertingFileV2) mapTemplates(alertingFile *AlertingFile) error {
	for _, ttV2 := range fileV2.Templates {
		alertingFile.Templates = append(alertingFile.Templates, ttV2.mapToModel())
	}
	for _, deleteV1 := range fileV2.DeleteTemplates {
		delReq, err := deleteV1.mapToModel()
		if err != nil {
			return err
		}
		alertingFile.DeleteTemplates = append(alertingFile.DeleteTemplates, delReq)
	}
	return nil
}

func (fileV2 *AlertingFileV2) mapMuteTimes(alertingFile *AlertingFile) error {
	for _, mtV2 := range fileV2.MuteTimes {
		alertingFile.MuteTimes = append(alertingFile.MuteTimes, mtV2.mapToModel())
	}
	for _, deleteV1 := range fileV2.DeleteMuteTimes {
		delReq, err := deleteV1.mapToModel()
		if err != nil {
			return err
		}
		alertingFile.DeleteMuteTimes = append(alertingFile.DeleteMuteTimes, delReq)
	}
	return nil
}

func (fileV2 *AlertingFileV2) mapPolicies(alertingFile *AlertingFile) error {
	for _, npV2 := range fileV2.Policies {
		np, err := npV2.mapToModel()
		if err != nil {
			return err
		}
		alertingFile.Policies = append(alertingFile.Policies, np)
	}
	for _, orgIDV1 := range fileV2.ResetPolicies {
		alertingFile.ResetPolicies = append(alertingFile.ResetPolicies, OrgID(orgIDV1.Value()))
	}
	return nil
}

func (fileV2 *AlertingFileV2) mapContactPoint(alertingFile *AlertingFile) error {
	for _, dcp := range fileV2.DeleteContactPoints {
		alertingFile.DeleteContactPoints = append(alertingFile.DeleteContactPoints, dcp.MapToModel())
	}
	for _, contactPointV2 := range fileV2.ContactPoints {
		contactPoint, err := contactPointV2.MapToModel()
		if err != nil {
			return err
		}
		alertingFile.ContactPoints = append(alertingFile.ContactPoints, contactPoint)
	}
	return nil
}

func (fileV2 *AlertingFileV2) mapRules(alertingFile *AlertingFile,
	ds datasources.DataSourceService) error {
	for _, groupV2 := range fileV2.Groups {
		group, err := groupV2.mapToModel(ds)
		if err != nil {
			return err
		}
		alertingFile.Groups = append(alertingFile.Groups, group)
	}
	for _, ruleDeleteV2 := range fileV2.DeleteRules {
		orgID := ruleDeleteV2.OrgID.Value()
		if orgID < 1 {
			orgID = 1
		}
		ruleDelete := RuleDelete{
			UID:   ruleDeleteV2.UID.Value(),
			OrgID: orgID,
		}
		alertingFile.DeleteRules = append(alertingFile.DeleteRules, ruleDelete)
	}
	return nil
}

// fileV2Mapper is a wrapper that helps with the v2.
type fileV2Mapper struct {
	datasourceService datasources.DataSourceService
	file              *AlertingFileV2
}

func (mapper *fileV2Mapper) Map() (AlertingFile, error) {
	alertingFile := AlertingFile{}
	alertingFile.Filename = mapper.file.Filename
	if err := mapper.file.mapRules(&alertingFile, mapper.datasourceService); err != nil {
		return AlertingFile{}, fmt.Errorf("failure parsing rules: %w", err)
	}
	if err := mapper.file.mapContactPoint(&alertingFile); err != nil {
		return AlertingFile{}, fmt.Errorf("failure parsing contact points: %w", err)
	}
	if err := mapper.file.mapPolicies(&alertingFile); err != nil {
		return AlertingFile{}, fmt.Errorf("failure parsing policies: %w", err)
	}
	if err := mapper.file.mapMuteTimes(&alertingFile); err != nil {
		return AlertingFile{}, fmt.Errorf("failure parsing mute times: %w", err)
	}
	if err := mapper.file.mapTemplates(&alertingFile); err != nil {
		return AlertingFile{}, fmt.Errorf("failure parsing templates: %w", err)
	}
	return alertingFile, nil
}
