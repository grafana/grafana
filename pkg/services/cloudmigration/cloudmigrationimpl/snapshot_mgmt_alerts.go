package cloudmigrationimpl

import (
	"context"
	"fmt"
	"time"

	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/components/simplejson"
	ngalertapi "github.com/grafana/grafana/pkg/services/ngalert/api/compat"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

type muteTimeInterval struct {
	UID string `json:"uid"`

	// There is a lot of custom (de)serialization logic from Alertmanager,
	// and this is the same type used by the underlying API, hence we can use the type as-is.
	config.MuteTimeInterval `json:",inline"`
}

func (s *Service) getAlertMuteTimings(ctx context.Context, signedInUser *user.SignedInUser) ([]muteTimeInterval, error) {
	muteTimings, err := s.ngAlert.Api.MuteTimings.GetMuteTimings(ctx, signedInUser.OrgID)
	if err != nil {
		return nil, fmt.Errorf("fetching ngalert mute timings: %w", err)
	}

	muteTimeIntervals := make([]muteTimeInterval, 0, len(muteTimings))

	for _, muteTiming := range muteTimings {
		muteTimeIntervals = append(muteTimeIntervals, muteTimeInterval{
			UID: muteTiming.UID,
			MuteTimeInterval: config.MuteTimeInterval{
				Name:          muteTiming.Name,
				TimeIntervals: muteTiming.TimeIntervals,
			},
		})
	}

	return muteTimeIntervals, nil
}

type notificationTemplate struct {
	UID      string `json:"uid"`
	Name     string `json:"name"`
	Template string `json:"template"`
}

func (s *Service) getNotificationTemplates(ctx context.Context, signedInUser *user.SignedInUser) ([]notificationTemplate, error) {
	templates, err := s.ngAlert.Api.Templates.GetTemplates(ctx, signedInUser.OrgID)
	if err != nil {
		return nil, fmt.Errorf("fetching ngalert notification templates: %w", err)
	}

	notificationTemplates := make([]notificationTemplate, 0, len(templates))

	for _, template := range templates {
		notificationTemplates = append(notificationTemplates, notificationTemplate{
			UID:      template.UID,
			Name:     template.Name,
			Template: template.Template,
		})
	}

	return notificationTemplates, nil
}

type contactPoint struct {
	Settings              *simplejson.Json `json:"settings"`
	UID                   string           `json:"uid"`
	Name                  string           `json:"name"`
	Type                  string           `json:"type"`
	DisableResolveMessage bool             `json:"disableResolveMessage"`
}

func (s *Service) getContactPoints(ctx context.Context, signedInUser *user.SignedInUser) ([]contactPoint, error) {
	query := provisioning.ContactPointQuery{
		OrgID:   signedInUser.GetOrgID(),
		Decrypt: true, // needed to recreate the settings in the target instance.
	}

	embeddedContactPoints, err := s.ngAlert.Api.ContactPointService.GetContactPoints(ctx, query, signedInUser)
	if err != nil {
		return nil, fmt.Errorf("fetching ngalert contact points: %w", err)
	}

	contactPoints := make([]contactPoint, 0, len(embeddedContactPoints))

	for _, embeddedContactPoint := range embeddedContactPoints {
		// This happens in the default contact point, and would otherwise fail to migrate because it has no UID.
		// If that contact point is edited in any way, an UID is generated.
		if embeddedContactPoint.UID == "" {
			continue
		}

		contactPoints = append(contactPoints, contactPoint{
			UID:                   embeddedContactPoint.UID,
			Name:                  embeddedContactPoint.Name,
			Type:                  embeddedContactPoint.Type,
			Settings:              embeddedContactPoint.Settings,
			DisableResolveMessage: embeddedContactPoint.DisableResolveMessage,
		})
	}

	return contactPoints, nil
}

type notificationPolicy struct {
	Name   string
	Routes definitions.Route
}

func (s *Service) getNotificationPolicies(ctx context.Context, signedInUser *user.SignedInUser) (notificationPolicy, error) {
	policyTree, _, err := s.ngAlert.Api.Policies.GetPolicyTree(ctx, signedInUser.GetOrgID())
	if err != nil {
		return notificationPolicy{}, fmt.Errorf("fetching ngalert notification policy tree: %w", err)
	}

	return notificationPolicy{
		Name:   "Notification Policy Tree",
		Routes: policyTree,
	}, nil
}

type alertRule struct {
	Updated              time.Time                                  `json:"updated,omitempty"`
	Annotations          map[string]string                          `json:"annotations,omitempty"`
	Labels               map[string]string                          `json:"labels,omitempty"`
	Record               *definitions.Record                        `json:"record"`
	NotificationSettings *definitions.AlertRuleNotificationSettings `json:"notification_settings"`
	FolderUID            string                                     `json:"folderUID"`
	RuleGroup            string                                     `json:"ruleGroup"`
	NoDataState          string                                     `json:"noDataState"`
	Condition            string                                     `json:"condition"`
	UID                  string                                     `json:"uid"`
	Title                string                                     `json:"title"`
	ExecErrState         string                                     `json:"execErrState"`
	Data                 []definitions.AlertQuery                   `json:"data"`
	For                  model.Duration                             `json:"for"`
	OrgID                int64                                      `json:"orgID"`
	IsPaused             bool                                       `json:"isPaused"`
}

func (s *Service) getAlertRules(ctx context.Context, signedInUser *user.SignedInUser) ([]alertRule, error) {
	alertRules, _, err := s.ngAlert.Api.AlertRules.GetAlertRules(ctx, signedInUser)
	if err != nil {
		return nil, fmt.Errorf("fetching alert rules: %w", err)
	}

	settingAlertRulesPaused := s.cfg.CloudMigration.AlertRulesState == setting.GMSAlertRulesPaused

	provisionedAlertRules := make([]alertRule, 0, len(alertRules))

	for _, rule := range alertRules {
		isPaused := rule.IsPaused
		if settingAlertRulesPaused {
			isPaused = true
		}

		provisionedAlertRules = append(provisionedAlertRules, alertRule{
			UID:                  rule.UID,
			OrgID:                rule.OrgID,
			FolderUID:            rule.NamespaceUID,
			RuleGroup:            rule.RuleGroup,
			Title:                rule.Title,
			For:                  model.Duration(rule.For),
			Condition:            rule.Condition,
			Data:                 ngalertapi.ApiAlertQueriesFromAlertQueries(rule.Data),
			Updated:              rule.Updated,
			NoDataState:          rule.NoDataState.String(),
			ExecErrState:         rule.ExecErrState.String(),
			Annotations:          rule.Annotations,
			Labels:               rule.Labels,
			IsPaused:             isPaused,
			NotificationSettings: ngalertapi.AlertRuleNotificationSettingsFromNotificationSettings(rule.NotificationSettings),
			Record:               ngalertapi.ApiRecordFromModelRecord(rule.Record),
		})
	}

	return provisionedAlertRules, nil
}

type alertRuleGroup struct {
	Title     string      `json:"title"`
	FolderUID string      `json:"folderUid"`
	Interval  int64       `json:"interval"`
	Rules     []alertRule `json:"rules"`
}

func (s *Service) getAlertRuleGroups(ctx context.Context, signedInUser *user.SignedInUser) ([]alertRuleGroup, error) {
	alertRuleGroupsWithFolder, err := s.ngAlert.Api.AlertRules.GetAlertGroupsWithFolderFullpath(ctx, signedInUser, nil)
	if err != nil {
		return nil, fmt.Errorf("fetching alert rule groups with folders: %w", err)
	}

	settingAlertRulesPaused := s.cfg.CloudMigration.AlertRulesState == setting.GMSAlertRulesPaused

	alertRuleGroups := make([]alertRuleGroup, 0, len(alertRuleGroupsWithFolder))

	for _, ruleGroup := range alertRuleGroupsWithFolder {
		provisionedAlertRules := make([]alertRule, 0, len(ruleGroup.Rules))

		for _, rule := range ruleGroup.Rules {
			isPaused := rule.IsPaused
			if settingAlertRulesPaused {
				isPaused = true
			}

			provisionedAlertRules = append(provisionedAlertRules, alertRule{
				UID:                  rule.UID,
				OrgID:                rule.OrgID,
				FolderUID:            rule.NamespaceUID,
				RuleGroup:            rule.RuleGroup,
				Title:                rule.Title,
				For:                  model.Duration(rule.For),
				Condition:            rule.Condition,
				Data:                 ngalertapi.ApiAlertQueriesFromAlertQueries(rule.Data),
				Updated:              rule.Updated,
				NoDataState:          rule.NoDataState.String(),
				ExecErrState:         rule.ExecErrState.String(),
				Annotations:          rule.Annotations,
				Labels:               rule.Labels,
				IsPaused:             isPaused,
				NotificationSettings: ngalertapi.AlertRuleNotificationSettingsFromNotificationSettings(rule.NotificationSettings),
				Record:               ngalertapi.ApiRecordFromModelRecord(rule.Record),
			})
		}

		alertRuleGroups = append(alertRuleGroups, alertRuleGroup{
			Title:     ruleGroup.Title,
			FolderUID: ruleGroup.FolderUID,
			Interval:  ruleGroup.Interval,
			Rules:     provisionedAlertRules,
		})
	}

	return alertRuleGroups, nil
}
