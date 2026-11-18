package models_test

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/models/modelstest"

	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func TestValidate(t *testing.T) {
	validNotificationSettings := modelstest.NotificationSettingsGen(modelstest.NSMuts.WithGroupBy(model.AlertNameLabel, models.FolderTitleLabel))

	testCases := []struct {
		name                 string
		notificationSettings models.NotificationSettings
		expErrorContains     string
	}{
		{
			name:                 "valid notification settings",
			notificationSettings: validNotificationSettings(),
		},
		{
			name:                 "missing receiver is invalid",
			notificationSettings: modelstest.CopyNotificationSettings(validNotificationSettings(), modelstest.NSMuts.WithReceiver("")),
			expErrorContains:     "receiver",
		},
		{
			name:                 "group by empty is valid",
			notificationSettings: modelstest.CopyNotificationSettings(validNotificationSettings(), modelstest.NSMuts.WithGroupBy()),
		},
		{
			name:                 "group by ... is valid",
			notificationSettings: modelstest.CopyNotificationSettings(validNotificationSettings(), modelstest.NSMuts.WithGroupBy("...")),
		},
		{
			name:                 "group by with alert name and folder name labels is valid",
			notificationSettings: modelstest.CopyNotificationSettings(validNotificationSettings(), modelstest.NSMuts.WithGroupBy(model.AlertNameLabel, models.FolderTitleLabel)),
		},
		{
			name:                 "group by missing alert name label is valid",
			notificationSettings: modelstest.CopyNotificationSettings(validNotificationSettings(), modelstest.NSMuts.WithGroupBy(models.FolderTitleLabel)),
		},
		{
			name:                 "group by missing folder name label is valid",
			notificationSettings: modelstest.CopyNotificationSettings(validNotificationSettings(), modelstest.NSMuts.WithGroupBy(model.AlertNameLabel)),
		},
		{
			name:                 "group by with duplicate values is invalid",
			notificationSettings: modelstest.CopyNotificationSettings(validNotificationSettings(), modelstest.NSMuts.WithGroupBy(model.AlertNameLabel, models.FolderTitleLabel, model.AlertNameLabel)),
			expErrorContains:     "duplicate",
		},
		{
			name:                 "group wait empty is valid",
			notificationSettings: modelstest.CopyNotificationSettings(validNotificationSettings(), modelstest.NSMuts.WithGroupWait(nil)),
		},
		{
			name:                 "group wait positive is valid",
			notificationSettings: modelstest.CopyNotificationSettings(validNotificationSettings(), modelstest.NSMuts.WithGroupWait(new(1*time.Second))),
		},
		{
			name:                 "group wait negative is invalid",
			notificationSettings: modelstest.CopyNotificationSettings(validNotificationSettings(), modelstest.NSMuts.WithGroupWait(new(-1*time.Second))),
			expErrorContains:     "group wait",
		},
		{
			name:                 "group interval empty is valid",
			notificationSettings: modelstest.CopyNotificationSettings(validNotificationSettings(), modelstest.NSMuts.WithGroupInterval(nil)),
		},
		{
			name:                 "group interval positive is valid",
			notificationSettings: modelstest.CopyNotificationSettings(validNotificationSettings(), modelstest.NSMuts.WithGroupInterval(new(1*time.Second))),
		},
		{
			name:                 "group interval negative is invalid",
			notificationSettings: modelstest.CopyNotificationSettings(validNotificationSettings(), modelstest.NSMuts.WithGroupInterval(new(-1*time.Second))),
			expErrorContains:     "group interval",
		},
		{
			name:                 "group interval zero is invalid",
			notificationSettings: modelstest.CopyNotificationSettings(validNotificationSettings(), modelstest.NSMuts.WithGroupInterval(new(0*time.Second))),
			expErrorContains:     "group interval",
		},
		{
			name:                 "repeat interval empty is valid",
			notificationSettings: modelstest.CopyNotificationSettings(validNotificationSettings(), modelstest.NSMuts.WithRepeatInterval(nil)),
		},
		{
			name:                 "repeat interval positive is valid",
			notificationSettings: modelstest.CopyNotificationSettings(validNotificationSettings(), modelstest.NSMuts.WithRepeatInterval(new(1*time.Second))),
		},
		{
			name:                 "repeat interval negative is invalid",
			notificationSettings: modelstest.CopyNotificationSettings(validNotificationSettings(), modelstest.NSMuts.WithRepeatInterval(new(-1*time.Second))),
			expErrorContains:     "repeat interval",
		},
		{
			name:                 "repeat interval zero is invalid",
			notificationSettings: modelstest.CopyNotificationSettings(validNotificationSettings(), modelstest.NSMuts.WithRepeatInterval(new(0*time.Second))),
			expErrorContains:     "repeat interval",
		},
		{
			name:                 "valid notification settings with policy routing",
			notificationSettings: models.NotificationSettingsFromPolicy("policy"),
		},
		{
			name:                 "empty policy is invalid",
			notificationSettings: models.NotificationSettingsFromPolicy(""),
			expErrorContains:     "policy must be specified",
		},
		{
			name:                 "default policy is invalid",
			notificationSettings: models.NotificationSettingsFromPolicy(models.DefaultRoutingTreeName),
			expErrorContains:     "default",
		},
		{
			name:                 "contact point and policy routing both unspecific is valid",
			notificationSettings: models.NotificationSettings{}, // Additional checks are done at the API level to reject this, but at the model level it's ok to ignore this state.
		},
		{
			name:                 "contact point and policy routing both specific is invalid",
			notificationSettings: modelstest.CopyNotificationSettings(validNotificationSettings(), modelstest.NSMuts.WithPolicy("policy")),
			expErrorContains:     "only one of policy routing or contact point routing can be specified",
		},
	}

	for _, tt := range testCases {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.notificationSettings.Validate()
			if tt.expErrorContains != "" {
				require.Error(t, err)
				require.ErrorContains(t, err, tt.expErrorContains)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestContactPointRoutingLabels(t *testing.T) {
	timeInterval := "time-interval-1"

	testCases := []struct {
		name                 string
		notificationSettings models.ContactPointRouting
		labels               data.Labels
	}{
		{
			name:                 "default notification settings",
			notificationSettings: models.NewDefaultContactPointRouting("receiver name"),
			labels: data.Labels{
				models.AutogeneratedRouteLabel:             "true",
				models.AutogeneratedRouteReceiverNameLabel: "receiver name",
			},
		},
		{
			name: "default notification settings with hardcoded default group by",
			notificationSettings: models.ContactPointRouting{
				Receiver: "receiver name",
				GroupBy:  models.DefaultNotificationSettingsGroupBy,
			},
			labels: data.Labels{
				models.AutogeneratedRouteLabel:             "true",
				models.AutogeneratedRouteReceiverNameLabel: "receiver name",
				models.AutogeneratedRouteSettingsHashLabel: "c65d254ff4c279f2",
			},
		},
		{
			name: "custom notification settings",
			notificationSettings: models.ContactPointRouting{
				Receiver:          "receiver name",
				GroupBy:           []string{"label1", "label2"},
				GroupWait:         new(model.Duration(1 * time.Minute)),
				GroupInterval:     new(model.Duration(2 * time.Minute)),
				RepeatInterval:    new(model.Duration(3 * time.Minute)),
				MuteTimeIntervals: []string{"maintenance1", "maintenance2"},
			},
			labels: data.Labels{
				models.AutogeneratedRouteLabel:             "true",
				models.AutogeneratedRouteReceiverNameLabel: "receiver name",
				models.AutogeneratedRouteSettingsHashLabel: "634e52b238fc78f0",
			},
		},
		{
			name: "custom notification settings with active time interval",
			notificationSettings: models.ContactPointRouting{
				Receiver:            "receiver name",
				GroupBy:             []string{"label1", "label2"},
				GroupWait:           new(model.Duration(1 * time.Minute)),
				GroupInterval:       new(model.Duration(2 * time.Minute)),
				RepeatInterval:      new(model.Duration(3 * time.Minute)),
				MuteTimeIntervals:   []string{"maintenance1", "maintenance2"},
				ActiveTimeIntervals: []string{"active1", "active2"},
			},
			labels: data.Labels{
				models.AutogeneratedRouteLabel:             "true",
				models.AutogeneratedRouteReceiverNameLabel: "receiver name",
				models.AutogeneratedRouteSettingsHashLabel: "9ac606ba0f6bcfb5",
			},
		},
		{
			name:                 "default notification settings with active time interval",
			notificationSettings: modelstest.CopyContactPointRouting(models.NewDefaultContactPointRouting("receiver name"), modelstest.CPRMuts.WithActiveTimeIntervals(timeInterval)),
			labels: data.Labels{
				models.AutogeneratedRouteLabel:             "true",
				models.AutogeneratedRouteReceiverNameLabel: "receiver name",
				models.AutogeneratedRouteSettingsHashLabel: "8304d9c06fda36e2",
			},
		},
		{
			name:                 "default notification settings with mute time interval",
			notificationSettings: modelstest.CopyContactPointRouting(models.NewDefaultContactPointRouting("receiver name"), modelstest.CPRMuts.WithMuteTimeIntervals(timeInterval)),
			labels: data.Labels{
				models.AutogeneratedRouteLabel:             "true",
				models.AutogeneratedRouteReceiverNameLabel: "receiver name",
				models.AutogeneratedRouteSettingsHashLabel: "171cfd2d4e0810fa",
			},
		},
	}

	for _, tt := range testCases {
		t.Run(tt.name, func(t *testing.T) {
			labels := tt.notificationSettings.ToLabels(nil)
			require.Equal(t, tt.labels, labels)
		})
	}
}

func TestNotificationSettings_TimeIntervals(t *testing.T) {
	// Create notification settings with default settings and usign the same
	// time interval, but in one case as a mute time interval and in another case
	// as an active time interval. They should produce different hashes.

	receiver := "receiver name"
	timeInterval := "time interval name"

	muteSettings := models.ContactPointRouting{
		Receiver:          receiver,
		MuteTimeIntervals: []string{timeInterval},
	}

	activeSettings := models.ContactPointRouting{
		Receiver:            receiver,
		ActiveTimeIntervals: []string{timeInterval},
	}

	require.NotEqual(t, activeSettings.Fingerprint(nil), muteSettings.Fingerprint(nil))
}

func TestNormalizedGroupBy(t *testing.T) {
	validNotificationSettings := modelstest.NotificationSettingsGen()

	testCases := []struct {
		name                      string
		notificationSettings      models.NotificationSettings
		expectedNormalizedGroupBy []string
	}{
		{
			name:                      "default group by is normal",
			notificationSettings:      modelstest.CopyNotificationSettings(validNotificationSettings(), modelstest.NSMuts.WithGroupBy(models.DefaultNotificationSettingsGroupBy...)),
			expectedNormalizedGroupBy: models.DefaultNotificationSettingsGroupBy,
		},
		{
			name:                      "group by ... is normal",
			notificationSettings:      modelstest.CopyNotificationSettings(validNotificationSettings(), modelstest.NSMuts.WithGroupBy(models.GroupByAll)),
			expectedNormalizedGroupBy: []string{models.GroupByAll},
		},
		{
			name:                 "group by empty is normal",
			notificationSettings: modelstest.CopyNotificationSettings(validNotificationSettings(), modelstest.NSMuts.WithGroupBy()),
		},
		{
			name:                      "group by with ... and other labels is not normal",
			notificationSettings:      modelstest.CopyNotificationSettings(validNotificationSettings(), modelstest.NSMuts.WithGroupBy(models.FolderTitleLabel, model.AlertNameLabel, models.GroupByAll)),
			expectedNormalizedGroupBy: []string{models.GroupByAll},
		},
		{
			name:                      "group by missing alert name label is not normal",
			notificationSettings:      modelstest.CopyNotificationSettings(validNotificationSettings(), modelstest.NSMuts.WithGroupBy(models.FolderTitleLabel)),
			expectedNormalizedGroupBy: models.DefaultNotificationSettingsGroupBy,
		},
		{
			name:                      "group by missing folder name label is not normal",
			notificationSettings:      modelstest.CopyNotificationSettings(validNotificationSettings(), modelstest.NSMuts.WithGroupBy(model.AlertNameLabel)),
			expectedNormalizedGroupBy: models.DefaultNotificationSettingsGroupBy,
		},
		{
			name:                      "group by with all required labels plus extra is normal",
			notificationSettings:      modelstest.CopyNotificationSettings(validNotificationSettings(), modelstest.NSMuts.WithGroupBy(models.FolderTitleLabel, model.AlertNameLabel, "custom")),
			expectedNormalizedGroupBy: []string{models.FolderTitleLabel, model.AlertNameLabel, "custom"},
		},
		{
			name:                      "ensure consistent ordering, required labels in front followed by sorted custom labels ",
			notificationSettings:      modelstest.CopyNotificationSettings(validNotificationSettings(), modelstest.NSMuts.WithGroupBy("custom", model.AlertNameLabel, "something", models.FolderTitleLabel, "other")),
			expectedNormalizedGroupBy: []string{models.FolderTitleLabel, model.AlertNameLabel, "custom", "other", "something"},
		},
		{
			name:                      "deduplicates repeated labels",
			notificationSettings:      modelstest.CopyNotificationSettings(validNotificationSettings(), modelstest.NSMuts.WithGroupBy(model.AlertNameLabel, "custom", model.AlertNameLabel, "custom")),
			expectedNormalizedGroupBy: []string{models.FolderTitleLabel, model.AlertNameLabel, "custom"},
		},
		{
			name:                      "deduplicates ... leaving only ...",
			notificationSettings:      modelstest.CopyNotificationSettings(validNotificationSettings(), modelstest.NSMuts.WithGroupBy(models.GroupByAll, models.GroupByAll)),
			expectedNormalizedGroupBy: []string{models.GroupByAll},
		},
	}

	for _, tt := range testCases {
		t.Run(tt.name, func(t *testing.T) {
			normalized := tt.notificationSettings.ContactPointRouting.NormalizedGroupBy()
			require.Equal(t, normalized, tt.expectedNormalizedGroupBy)
		})
	}
}

func TestFingerprintStabilityWithDuplicateGroupBy(t *testing.T) {
	withDups := models.ContactPointRouting{Receiver: "receiver", GroupBy: []string{model.AlertNameLabel, "custom", model.AlertNameLabel, "custom"}}
	withoutDups := models.ContactPointRouting{Receiver: "receiver", GroupBy: []string{model.AlertNameLabel, "custom"}}
	require.Equal(t, withDups.Fingerprint(nil), withoutDups.Fingerprint(nil),
		"fingerprint should be identical for semantically equivalent group_by regardless of duplicates")
}
