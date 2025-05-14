package store

import (
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/util"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func alertRuleToModelsAlertRule(ar alertRule, l log.Logger) (models.AlertRule, error) {
	var data []models.AlertQuery
	err := json.Unmarshal([]byte(ar.Data), &data)
	if err != nil {
		return models.AlertRule{}, fmt.Errorf("failed to parse data: %w", err)
	}

	result := models.AlertRule{
		ID:              ar.ID,
		OrgID:           ar.OrgID,
		GUID:            ar.GUID,
		Title:           ar.Title,
		Condition:       ar.Condition,
		Data:            data,
		Updated:         ar.Updated,
		IntervalSeconds: ar.IntervalSeconds,
		Version:         ar.Version,
		UID:             ar.UID,
		NamespaceUID:    ar.NamespaceUID,
		DashboardUID:    ar.DashboardUID,
		PanelID:         ar.PanelID,
		RuleGroup:       ar.RuleGroup,
		RuleGroupIndex:  ar.RuleGroupIndex,
		For:             ar.For,
		IsPaused:        ar.IsPaused,
	}

	if ar.UpdatedBy != nil {
		result.UpdatedBy = util.Pointer(models.UserUID(*ar.UpdatedBy))
	}

	if ar.NoDataState != "" {
		result.NoDataState, err = models.NoDataStateFromString(ar.NoDataState)
		if err != nil {
			l.Warn("Unknown NoDataState value, defaulting to NoData", append(result.GetKey().LogContext(), "original", ar.NoDataState)...)
			result.NoDataState = models.NoData
		}
	}
	if ar.ExecErrState != "" {
		result.ExecErrState, err = models.ErrStateFromString(ar.ExecErrState)
		if err != nil {
			l.Warn("Unknown ExecErrState value, defaulting to Error", append(result.GetKey().LogContext(), "original", ar.ExecErrState)...)
			result.ExecErrState = models.ErrorErrState
		}
	}

	if ar.Record != "" {
		var record models.Record
		err = json.Unmarshal([]byte(ar.Record), &record)
		if err != nil {
			return models.AlertRule{}, fmt.Errorf("failed to parse record: %w", err)
		}
		result.Record = &record
	}

	if ar.Labels != "" {
		err = json.Unmarshal([]byte(ar.Labels), &result.Labels)
		if err != nil {
			return models.AlertRule{}, fmt.Errorf("failed to parse labels: %w", err)
		}
	}

	if ar.Annotations != "" {
		err = json.Unmarshal([]byte(ar.Annotations), &result.Annotations)
		if err != nil {
			return models.AlertRule{}, fmt.Errorf("failed to parse annotations: %w", err)
		}
	}

	if ar.NotificationSettings != "" {
		ns, err := parseNotificationSettings(ar.NotificationSettings)
		if err != nil {
			return models.AlertRule{}, fmt.Errorf("failed to parse notification settings: %w", err)
		}
		result.NotificationSettings = ns
	}

	if ar.Metadata != "" {
		err = json.Unmarshal([]byte(ar.Metadata), &result.Metadata)
		if err != nil {
			return models.AlertRule{}, fmt.Errorf("failed to metadata: %w", err)
		}
	}

	return result, nil
}

func parseNotificationSettings(s string) ([]models.NotificationSettings, error) {
	var result []models.NotificationSettings
	if err := json.Unmarshal([]byte(s), &result); err != nil {
		return nil, err
	}
	return result, nil
}

func alertRuleFromModelsAlertRule(ar models.AlertRule) (alertRule, error) {
	result := alertRule{
		ID:              ar.ID,
		GUID:            ar.GUID,
		OrgID:           ar.OrgID,
		Title:           ar.Title,
		Condition:       ar.Condition,
		Updated:         ar.Updated,
		IntervalSeconds: ar.IntervalSeconds,
		Version:         ar.Version,
		UID:             ar.UID,
		NamespaceUID:    ar.NamespaceUID,
		DashboardUID:    ar.DashboardUID,
		PanelID:         ar.PanelID,
		RuleGroup:       ar.RuleGroup,
		RuleGroupIndex:  ar.RuleGroupIndex,
		NoDataState:     ar.NoDataState.String(),
		ExecErrState:    ar.ExecErrState.String(),
		For:             ar.For,
		IsPaused:        ar.IsPaused,
	}

	if ar.UpdatedBy != nil {
		result.UpdatedBy = util.Pointer(string(*ar.UpdatedBy))
	}

	// Serialize complex types to JSON strings
	data, err := json.Marshal(ar.Data)
	if err != nil {
		return alertRule{}, fmt.Errorf("failed to marshal data: %w", err)
	}
	result.Data = string(data)

	if ar.Record != nil {
		recordData, err := json.Marshal(ar.Record)
		if err != nil {
			return alertRule{}, fmt.Errorf("failed to marshal record: %w", err)
		}
		result.Record = string(recordData)
	}

	if len(ar.Annotations) > 0 {
		annotationsData, err := json.Marshal(ar.Annotations)
		if err != nil {
			return alertRule{}, fmt.Errorf("failed to marshal annotations: %w", err)
		}
		result.Annotations = string(annotationsData)
	}

	if len(ar.Labels) > 0 {
		labelsData, err := json.Marshal(ar.Labels)
		if err != nil {
			return alertRule{}, fmt.Errorf("failed to marshal labels: %w", err)
		}
		result.Labels = string(labelsData)
	}

	if len(ar.NotificationSettings) > 0 {
		notificationSettingsData, err := json.Marshal(ar.NotificationSettings)
		if err != nil {
			return alertRule{}, fmt.Errorf("failed to marshal notification settings: %w", err)
		}
		result.NotificationSettings = string(notificationSettingsData)
	}

	metadata, err := json.Marshal(ar.Metadata)
	if err != nil {
		return alertRule{}, fmt.Errorf("failed to metadata: %w", err)
	}
	result.Metadata = string(metadata)

	return result, nil
}

func alertRuleToAlertRuleVersion(rule alertRule) alertRuleVersion {
	return alertRuleVersion{
		RuleOrgID:            rule.OrgID,
		RuleGUID:             rule.GUID,
		RuleUID:              rule.UID,
		RuleNamespaceUID:     rule.NamespaceUID,
		RuleGroup:            rule.RuleGroup,
		RuleGroupIndex:       rule.RuleGroupIndex,
		ParentVersion:        0,
		RestoredFrom:         0,
		Version:              rule.Version,
		Created:              rule.Updated, // assuming the Updated time as the creation time
		CreatedBy:            rule.UpdatedBy,
		Title:                rule.Title,
		Condition:            rule.Condition,
		Data:                 rule.Data,
		IntervalSeconds:      rule.IntervalSeconds,
		Record:               rule.Record,
		NoDataState:          rule.NoDataState,
		ExecErrState:         rule.ExecErrState,
		For:                  rule.For,
		Annotations:          rule.Annotations,
		Labels:               rule.Labels,
		IsPaused:             rule.IsPaused,
		NotificationSettings: rule.NotificationSettings,
		Metadata:             rule.Metadata,
	}
}

func alertRuleVersionToAlertRule(version alertRuleVersion) alertRule {
	return alertRule{
		ID:              version.ID,
		GUID:            version.RuleGUID,
		OrgID:           version.RuleOrgID,
		Title:           version.Title,
		Condition:       version.Condition,
		Data:            version.Data,
		Updated:         version.Created,
		UpdatedBy:       version.CreatedBy,
		IntervalSeconds: version.IntervalSeconds,
		Version:         version.Version,
		UID:             version.RuleUID,
		NamespaceUID:    version.RuleNamespaceUID,
		// Versions do not store Dashboard\Panel as separate column.
		// However, these fields are part of annotations and information in these fields is redundant
		DashboardUID:         nil,
		PanelID:              nil,
		RuleGroup:            version.RuleGroup,
		RuleGroupIndex:       version.RuleGroupIndex,
		Record:               version.Record,
		NoDataState:          version.NoDataState,
		ExecErrState:         version.ExecErrState,
		For:                  version.For,
		Annotations:          version.Annotations,
		Labels:               version.Labels,
		IsPaused:             version.IsPaused,
		NotificationSettings: version.NotificationSettings,
		Metadata:             version.Metadata,
	}
}
