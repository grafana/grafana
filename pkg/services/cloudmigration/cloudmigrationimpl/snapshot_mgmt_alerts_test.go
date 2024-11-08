package cloudmigrationimpl

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/stretchr/testify/require"

	"github.com/grafana/alerting/definition"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	ac "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestGetAlertMuteTimings(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	t.Run("when the feature flag `onPremToCloudMigrationsAlerts` is not enabled it returns nil", func(t *testing.T) {
		s := setUpServiceTest(t, false).(*Service)
		s.features = featuremgmt.WithFeatures(featuremgmt.FlagOnPremToCloudMigrations)

		muteTimeIntervals, err := s.getAlertMuteTimings(ctx, nil)
		require.NoError(t, err)
		require.Nil(t, muteTimeIntervals)
	})

	t.Run("when the feature flag `onPremToCloudMigrationsAlerts` is enabled it returns the mute timings", func(t *testing.T) {
		s := setUpServiceTest(t, false).(*Service)
		s.features = featuremgmt.WithFeatures(featuremgmt.FlagOnPremToCloudMigrations, featuremgmt.FlagOnPremToCloudMigrationsAlerts)

		user := &user.SignedInUser{OrgID: 1}

		createdMuteTiming := createMuteTiming(t, ctx, s, user)

		muteTimeIntervals, err := s.getAlertMuteTimings(ctx, user)
		require.NoError(t, err)
		require.NotNil(t, muteTimeIntervals)
		require.Len(t, muteTimeIntervals, 1)
		require.Equal(t, createdMuteTiming.Name, muteTimeIntervals[0].Name)
	})
}

func TestGetNotificationTemplates(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	t.Run("when the feature flag `onPremToCloudMigrationsAlerts` is not enabled it returns nil", func(t *testing.T) {
		s := setUpServiceTest(t, false).(*Service)
		s.features = featuremgmt.WithFeatures(featuremgmt.FlagOnPremToCloudMigrations)

		notificationTemplates, err := s.getNotificationTemplates(ctx, nil)
		require.NoError(t, err)
		require.Nil(t, notificationTemplates)
	})

	t.Run("when the feature flag `onPremToCloudMigrationsAlerts` is enabled it returns the notification templates", func(t *testing.T) {
		s := setUpServiceTest(t, false).(*Service)
		s.features = featuremgmt.WithFeatures(featuremgmt.FlagOnPremToCloudMigrations, featuremgmt.FlagOnPremToCloudMigrationsAlerts)

		user := &user.SignedInUser{OrgID: 1}

		createdTemplate := createNotificationTemplate(t, ctx, s, user)

		notificationTemplates, err := s.getNotificationTemplates(ctx, user)
		require.NoError(t, err)
		require.NotNil(t, notificationTemplates)
		require.Len(t, notificationTemplates, 1)
		require.Equal(t, createdTemplate.Name, notificationTemplates[0].Name)
	})
}

func TestGetContactPoints(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	t.Run("when the feature flag `onPremToCloudMigrationsAlerts` is not enabled it returns nil", func(t *testing.T) {
		s := setUpServiceTest(t, false).(*Service)
		s.features = featuremgmt.WithFeatures(featuremgmt.FlagOnPremToCloudMigrations)

		contactPoints, err := s.getContactPoints(ctx, nil)
		require.NoError(t, err)
		require.Nil(t, contactPoints)
	})

	t.Run("when the feature flag `onPremToCloudMigrationsAlerts` is enabled it returns the contact points", func(t *testing.T) {
		s := setUpServiceTest(t, false).(*Service)
		s.features = featuremgmt.WithFeatures(featuremgmt.FlagOnPremToCloudMigrations, featuremgmt.FlagOnPremToCloudMigrationsAlerts)

		user := &user.SignedInUser{
			OrgID: 1,
			Permissions: map[int64]map[string][]string{
				1: {
					accesscontrol.ActionAlertingNotificationsRead:    nil,
					accesscontrol.ActionAlertingReceiversReadSecrets: {ac.ScopeReceiversAll},
				},
			},
		}

		defaultEmailContactPointCount := 1

		createdContactPoints := createContactPoints(t, ctx, s, user)

		contactPoints, err := s.getContactPoints(ctx, user)
		require.NoError(t, err)
		require.NotNil(t, contactPoints)
		require.Len(t, contactPoints, len(createdContactPoints)+defaultEmailContactPointCount)
	})
}

func TestGetNotificationPolicies(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	t.Run("when the feature flag `onPremToCloudMigrationsAlerts` is not enabled it returns nil", func(t *testing.T) {
		s := setUpServiceTest(t, false).(*Service)
		s.features = featuremgmt.WithFeatures(featuremgmt.FlagOnPremToCloudMigrations)

		notificationPolicies, err := s.getNotificationPolicies(ctx, nil)
		require.NoError(t, err)
		require.Empty(t, notificationPolicies)
	})

	t.Run("when the feature flag `onPremToCloudMigrationsAlerts` is enabled it returns the contact points", func(t *testing.T) {
		s := setUpServiceTest(t, false).(*Service)
		s.features = featuremgmt.WithFeatures(featuremgmt.FlagOnPremToCloudMigrations, featuremgmt.FlagOnPremToCloudMigrationsAlerts)

		user := &user.SignedInUser{OrgID: 1}

		muteTiming := createMuteTiming(t, ctx, s, user)
		require.NotEmpty(t, muteTiming.Name)

		contactPoints := createContactPoints(t, ctx, s, user)
		require.GreaterOrEqual(t, len(contactPoints), 1)

		updateNotificationPolicyTree(t, ctx, s, user, contactPoints[0].Name, muteTiming.Name)

		notificationPolicies, err := s.getNotificationPolicies(ctx, user)
		require.NoError(t, err)
		require.NotEmpty(t, notificationPolicies.Routes.Receiver)
		require.NotNil(t, notificationPolicies.Routes.Routes)
	})
}

func TestGetAlertRules(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	t.Run("when the feature flag `onPremToCloudMigrationsAlerts` is not enabled it returns nil", func(t *testing.T) {
		s := setUpServiceTest(t, false).(*Service)
		s.features = featuremgmt.WithFeatures(featuremgmt.FlagOnPremToCloudMigrations)

		alertRules, err := s.getAlertRules(ctx, nil)
		require.NoError(t, err)
		require.Nil(t, alertRules)
	})

	t.Run("when the feature flag `onPremToCloudMigrationsAlerts` is enabled it returns the alert rules", func(t *testing.T) {
		s := setUpServiceTest(t, false).(*Service)
		s.features = featuremgmt.WithFeatures(featuremgmt.FlagOnPremToCloudMigrations, featuremgmt.FlagOnPremToCloudMigrationsAlerts)

		user := &user.SignedInUser{OrgID: 1}

		alertRule := createAlertRule(t, ctx, s, user)

		alertRules, err := s.getAlertRules(ctx, user)
		require.NoError(t, err)
		require.Len(t, alertRules, 1)
		require.Equal(t, alertRule.UID, alertRules[0].UID)
	})
}

func createMuteTiming(t *testing.T, ctx context.Context, service *Service, user *user.SignedInUser) definitions.MuteTimeInterval {
	t.Helper()

	muteTiming := `{
		"name": "My Unique MuteTiming 1",
		"time_intervals": [
			{
				"times": [{"start_time": "12:12","end_time": "23:23"}],
				"weekdays": ["monday","wednesday","friday","sunday"],
				"days_of_month": ["10:20","25:-1"],
				"months": ["1:6","10:12"],
				"years": ["2022:2054"],
				"location": "Africa/Douala"
			}
		]
	}`

	var mt definitions.MuteTimeInterval
	require.NoError(t, json.Unmarshal([]byte(muteTiming), &mt))

	createdTiming, err := service.ngAlert.Api.MuteTimings.CreateMuteTiming(ctx, mt, user.GetOrgID())
	require.NoError(t, err)

	return createdTiming
}

func createNotificationTemplate(t *testing.T, ctx context.Context, service *Service, user *user.SignedInUser) definitions.NotificationTemplate {
	t.Helper()

	tmpl := definitions.NotificationTemplate{
		Name:     "MyTestNotificationTemplate",
		Template: "This is a test template\n{{ .ExternalURL }}",
	}

	createdTemplate, err := service.ngAlert.Api.Templates.CreateTemplate(ctx, user.GetOrgID(), tmpl)
	require.NoError(t, err)

	return createdTemplate
}

func createContactPoints(t *testing.T, ctx context.Context, service *Service, user *user.SignedInUser) []definitions.EmbeddedContactPoint {
	t.Helper()

	slackSettings, err := simplejson.NewJson([]byte(`{
		"icon_emoji":"iconemoji",
		"icon_url":"iconurl",
		"recipient":"recipient",
		"token":"slack-secret",
		"username":"user"
	}`))
	require.NoError(t, err)

	telegramSettings, err := simplejson.NewJson([]byte(`{
		"bottoken":"telegram-secret",
		"chatid":"chat-id",
		"disable_notification":true,
		"disable_web_page_preview":false,
		"message_thread_id":"1234",
		"parse_mode":"None",
		"protect_content":true
	}`))
	require.NoError(t, err)

	nameGroup := "group_1"

	slackContactPoint := definitions.EmbeddedContactPoint{
		Name:                  nameGroup,
		Type:                  "slack",
		Settings:              slackSettings,
		DisableResolveMessage: false,
		Provenance:            "",
	}

	createdSlack, err := service.ngAlert.Api.ContactPointService.CreateContactPoint(ctx, user.GetOrgID(), user, slackContactPoint, "")
	require.NoError(t, err)

	telegramContactPoint := definitions.EmbeddedContactPoint{
		Name:                  nameGroup,
		Type:                  "telegram",
		Settings:              telegramSettings,
		DisableResolveMessage: false,
		Provenance:            "",
	}

	createdTelegram, err := service.ngAlert.Api.ContactPointService.CreateContactPoint(ctx, user.GetOrgID(), user, telegramContactPoint, "")
	require.NoError(t, err)

	return []definitions.EmbeddedContactPoint{
		createdSlack,
		createdTelegram,
	}
}

func updateNotificationPolicyTree(t *testing.T, ctx context.Context, service *Service, user *user.SignedInUser, receiverGroup, muteTiming string) {
	t.Helper()

	child := definition.Route{
		Continue:          true,
		MuteTimeIntervals: []string{muteTiming},
		ObjectMatchers: definition.ObjectMatchers{
			{Name: "label1", Type: labels.MatchEqual, Value: "value1"},
			{Name: "label2", Type: labels.MatchNotEqual, Value: "value2"},
		},
		Receiver: receiverGroup,
	}

	tree := definition.Route{
		Receiver: "grafana-default-email",
		Routes:   []*definition.Route{&child},
	}

	_, _, err := service.ngAlert.Api.Policies.UpdatePolicyTree(ctx, user.GetOrgID(), tree, "", "")
	require.NoError(t, err)
}

func createAlertRule(t *testing.T, ctx context.Context, service *Service, user *user.SignedInUser) models.AlertRule {
	t.Helper()

	rule := models.AlertRule{
		OrgID:        user.GetOrgID(),
		Title:        "Alert Rule SLO",
		NamespaceUID: "folderUID",
		Condition:    "A",
		Data: []models.AlertQuery{
			{
				RefID: "A",
				Model: []byte(`{"queryType": "a"}`),
				RelativeTimeRange: models.RelativeTimeRange{
					From: models.Duration(60),
					To:   models.Duration(0),
				},
			},
		},
		RuleGroup:       "ruleGroup",
		For:             time.Minute,
		IntervalSeconds: 60,
		NoDataState:     models.OK,
		ExecErrState:    models.OkErrState,
	}

	createdRule, err := service.ngAlert.Api.AlertRules.CreateAlertRule(ctx, user, rule, "")
	require.NoError(t, err)

	return createdRule
}
