package cloudmigrationimpl

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	ac "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
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

		var orgID int64 = 1
		user := &user.SignedInUser{OrgID: orgID}

		createdMuteTiming := createMuteTiming(t, ctx, s, orgID)

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

		var orgID int64 = 1
		user := &user.SignedInUser{OrgID: orgID}

		createdTemplate := createNotificationTemplate(t, ctx, s, orgID)

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

func createMuteTiming(t *testing.T, ctx context.Context, service *Service, orgID int64) definitions.MuteTimeInterval {
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

	createdTiming, err := service.ngAlert.Api.MuteTimings.CreateMuteTiming(ctx, mt, orgID)
	require.NoError(t, err)

	return createdTiming
}

func createNotificationTemplate(t *testing.T, ctx context.Context, service *Service, orgID int64) definitions.NotificationTemplate {
	t.Helper()

	tmpl := definitions.NotificationTemplate{
		Name:     "MyTestNotificationTemplate",
		Template: "This is a test template\n{{ .ExternalURL }}",
	}

	createdTemplate, err := service.ngAlert.Api.Templates.CreateTemplate(ctx, orgID, tmpl)
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
