package notifiers

import (
	"fmt"
	"os"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/alerting/notifiers"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/stretchr/testify/require"
)

var (
	correctProperties            = "./testdata/test-configs/correct-properties"
	incorrectSettings            = "./testdata/test-configs/incorrect-settings"
	noRequiredFields             = "./testdata/test-configs/no-required-fields"
	correctPropertiesWithOrgName = "./testdata/test-configs/correct-properties-with-orgName"
	brokenYaml                   = "./testdata/test-configs/broken-yaml"
	doubleNotificationsConfig    = "./testdata/test-configs/double-default"
	emptyFolder                  = "./testdata/test-configs/empty_folder"
	emptyFile                    = "./testdata/test-configs/empty"
	twoNotificationsConfig       = "./testdata/test-configs/two-notifications"
	unknownNotifier              = "./testdata/test-configs/unknown-notifier"
)

func TestNotificationAsConfig(t *testing.T) {
	logger := log.New("fake.log")

	t.Run("Testing notification as configuration", func(t *testing.T) {
		sqlstore.InitTestDB(t)

		for i := 1; i < 5; i++ {
			orgCommand := models.CreateOrgCommand{Name: fmt.Sprintf("Main Org. %v", i)}
			err := sqlstore.CreateOrg(&orgCommand)
			require.NoError(t, err)
		}

		alerting.RegisterNotifier(&alerting.NotifierPlugin{
			Type:    "slack",
			Name:    "slack",
			Factory: notifiers.NewSlackNotifier,
		})

		alerting.RegisterNotifier(&alerting.NotifierPlugin{
			Type:    "email",
			Name:    "email",
			Factory: notifiers.NewEmailNotifier,
		})

		t.Run("Can read correct properties", func(t *testing.T) {
			_ = os.Setenv("TEST_VAR", "default")
			cfgProvider := &configReader{log: log.New("test logger")}
			cfg, err := cfgProvider.readConfig(correctProperties)
			_ = os.Unsetenv("TEST_VAR")
			if err != nil {
				t.Fatalf("readConfig return an error %v", err)
			}
			require.Equal(t, 1, len(cfg))

			ntCfg := cfg[0]
			nts := ntCfg.Notifications
			require.Equal(t, 4, len(nts))

			nt := nts[0]
			require.Equal(t, "default-slack-notification", nt.Name)
			require.Equal(t, "slack", nt.Type)
			require.Equal(t, 2, nt.OrgID)
			require.Equal(t, "notifier1", nt.UID)
			require.True(t, nt.IsDefault)
			So(nt.Settings, ShouldResemble, map[string]interface{}{
				"recipient": "XXX", "token": "xoxb", "uploadImage": true, "url": "https://slack.com",
			})
			So(nt.SecureSettings, ShouldResemble, map[string]string{
				"token": "xoxbsecure", "url": "https://slack.com/secure",
			})
			require.True(t, nt.SendReminder)
			require.Equal(t, "1h", nt.Frequency)

			nt = nts[1]
			require.Equal(t, "another-not-default-notification", nt.Name)
			require.Equal(t, "email", nt.Type)
			require.Equal(t, 3, nt.OrgID)
			require.Equal(t, "notifier2", nt.UID)
			require.False(t, nt.IsDefault)

			nt = nts[2]
			require.Equal(t, "check-unset-is_default-is-false", nt.Name)
			require.Equal(t, "slack", nt.Type)
			require.Equal(t, 3, nt.OrgID)
			require.Equal(t, "notifier3", nt.UID)
			require.False(t, nt.IsDefault)

			nt = nts[3]
			require.Equal(t, "Added notification with whitespaces in name", nt.Name)
			require.Equal(t, "email", nt.Type)
			require.Equal(t, "notifier4", nt.UID)
			require.Equal(t, 3, nt.OrgID)

			deleteNts := ntCfg.DeleteNotifications
			require.Equal(t, 4, len(deleteNts))

			deleteNt := deleteNts[0]
			require.Equal(t, "default-slack-notification", deleteNt.Name)
			require.Equal(t, "notifier1", deleteNt.UID)
			require.Equal(t, 2, deleteNt.OrgID)

			deleteNt = deleteNts[1]
			require.Equal(t, "deleted-notification-without-orgId", deleteNt.Name)
			require.Equal(t, 1, deleteNt.OrgID)
			require.Equal(t, "notifier2", deleteNt.UID)

			deleteNt = deleteNts[2]
			require.Equal(t, "deleted-notification-with-0-orgId", deleteNt.Name)
			require.Equal(t, 1, deleteNt.OrgID)
			require.Equal(t, "notifier3", deleteNt.UID)

			deleteNt = deleteNts[3]
			require.Equal(t, "Deleted notification with whitespaces in name", deleteNt.Name)
			require.Equal(t, 1, deleteNt.OrgID)
			require.Equal(t, "notifier4", deleteNt.UID)
		})

		t.Run("One configured notification", func(t *testing.T) {
			t.Run("no notification in database", func(t *testing.T) {
				dc := newNotificationProvisioner(logger)
				err := dc.applyChanges(twoNotificationsConfig)
				if err != nil {
					t.Fatalf("applyChanges return an error %v", err)
				}
				notificationsQuery := models.GetAllAlertNotificationsQuery{OrgId: 1}
				err = sqlstore.GetAllAlertNotifications(&notificationsQuery)
				require.NoError(t, err)
				require.NotNil(t, notificationsQuery.Result)
				require.Equal(t, 2, len(notificationsQuery.Result))
			})

			t.Run("One notification in database with same name and uid", func(t *testing.T) {
				existingNotificationCmd := models.CreateAlertNotificationCommand{
					Name:  "channel1",
					OrgId: 1,
					Uid:   "notifier1",
					Type:  "slack",
				}
				err := sqlstore.CreateAlertNotificationCommand(&existingNotificationCmd)
				require.NoError(t, err)
				require.NotNil(t, existingNotificationCmd.Result)
				notificationsQuery := models.GetAllAlertNotificationsQuery{OrgId: 1}
				err = sqlstore.GetAllAlertNotifications(&notificationsQuery)
				require.NoError(t, err)
				require.NotNil(t, notificationsQuery.Result)
				require.Equal(t, 1, len(notificationsQuery.Result))

				t.Run("should update one notification", func(t *testing.T) {
					dc := newNotificationProvisioner(logger)
					err = dc.applyChanges(twoNotificationsConfig)
					if err != nil {
						t.Fatalf("applyChanges return an error %v", err)
					}
					err = sqlstore.GetAllAlertNotifications(&notificationsQuery)
					require.NoError(t, err)
					require.NotNil(t, notificationsQuery.Result)
					require.Equal(t, 2, len(notificationsQuery.Result))

					nts := notificationsQuery.Result
					nt1 := nts[0]
					require.Equal(t, "email", nt1.Type)
					require.Equal(t, "channel1", nt1.Name)
					require.Equal(t, "notifier1", nt1.Uid)

					nt2 := nts[1]
					require.Equal(t, "slack", nt2.Type)
					require.Equal(t, "channel2", nt2.Name)
					require.Equal(t, "notifier2", nt2.Uid)
				})
			})
			t.Run("Two notifications with is_default", func(t *testing.T) {
				dc := newNotificationProvisioner(logger)
				err := dc.applyChanges(doubleNotificationsConfig)
				t.Run("should both be inserted", func(t *testing.T) {
					require.NoError(t, err)
					notificationsQuery := models.GetAllAlertNotificationsQuery{OrgId: 1}
					err = sqlstore.GetAllAlertNotifications(&notificationsQuery)
					require.NoError(t, err)
					require.NotNil(t, notificationsQuery.Result)
					require.Equal(t, 2, len(notificationsQuery.Result))

					require.True(t, notificationsQuery.Result[0].IsDefault)
					require.True(t, notificationsQuery.Result[1].IsDefault)
				})
			})
		})

		t.Run("Two configured notification", func(t *testing.T) {
			t.Run("two other notifications in database", func(t *testing.T) {
				existingNotificationCmd := models.CreateAlertNotificationCommand{
					Name:  "channel0",
					OrgId: 1,
					Uid:   "notifier0",
					Type:  "slack",
				}
				err := sqlstore.CreateAlertNotificationCommand(&existingNotificationCmd)
				require.NoError(t, err)
				existingNotificationCmd = models.CreateAlertNotificationCommand{
					Name:  "channel3",
					OrgId: 1,
					Uid:   "notifier3",
					Type:  "slack",
				}
				err = sqlstore.CreateAlertNotificationCommand(&existingNotificationCmd)
				require.NoError(t, err)

				notificationsQuery := models.GetAllAlertNotificationsQuery{OrgId: 1}
				err = sqlstore.GetAllAlertNotifications(&notificationsQuery)
				require.NoError(t, err)
				require.NotNil(t, notificationsQuery.Result)
				require.Equal(t, 2, len(notificationsQuery.Result))

				t.Run("should have two new notifications", func(t *testing.T) {
					dc := newNotificationProvisioner(logger)
					err := dc.applyChanges(twoNotificationsConfig)
					if err != nil {
						t.Fatalf("applyChanges return an error %v", err)
					}
					notificationsQuery = models.GetAllAlertNotificationsQuery{OrgId: 1}
					err = sqlstore.GetAllAlertNotifications(&notificationsQuery)
					require.NoError(t, err)
					require.NotNil(t, notificationsQuery.Result)
					require.Equal(t, 4, len(notificationsQuery.Result))
				})
			})
		})

		t.Run("Can read correct properties with orgName instead of orgId", func(t *testing.T) {
			existingOrg1 := models.GetOrgByNameQuery{Name: "Main Org. 1"}
			err := sqlstore.GetOrgByName(&existingOrg1)
			require.NoError(t, err)
			require.NotNil(t, existingOrg1.Result)
			existingOrg2 := models.GetOrgByNameQuery{Name: "Main Org. 2"}
			err = sqlstore.GetOrgByName(&existingOrg2)
			require.NoError(t, err)
			require.NotNil(t, existingOrg2.Result)

			existingNotificationCmd := models.CreateAlertNotificationCommand{
				Name:  "default-notification-delete",
				OrgId: existingOrg2.Result.Id,
				Uid:   "notifier2",
				Type:  "slack",
			}
			err = sqlstore.CreateAlertNotificationCommand(&existingNotificationCmd)
			require.NoError(t, err)

			dc := newNotificationProvisioner(logger)
			err = dc.applyChanges(correctPropertiesWithOrgName)
			if err != nil {
				t.Fatalf("applyChanges return an error %v", err)
			}

			notificationsQuery := models.GetAllAlertNotificationsQuery{OrgId: existingOrg2.Result.Id}
			err = sqlstore.GetAllAlertNotifications(&notificationsQuery)
			require.NoError(t, err)
			require.NotNil(t, notificationsQuery.Result)
			require.Equal(t, 1, len(notificationsQuery.Result))

			nt := notificationsQuery.Result[0]
			require.Equal(t, "default-notification-create", nt.Name)
			require.Equal(t, existingOrg2.Result.Id, nt.OrgId)
		})

		t.Run("Config doesn't contain required field", func(t *testing.T) {
			dc := newNotificationProvisioner(logger)
			err := dc.applyChanges(noRequiredFields)
			require.Error(t, err)

			errString := err.Error()
			So(errString, ShouldContainSubstring, "Deleted alert notification item 1 in configuration doesn't contain required field uid")
			So(errString, ShouldContainSubstring, "Deleted alert notification item 2 in configuration doesn't contain required field name")
			So(errString, ShouldContainSubstring, "Added alert notification item 1 in configuration doesn't contain required field name")
			So(errString, ShouldContainSubstring, "Added alert notification item 2 in configuration doesn't contain required field uid")
		})

		t.Run("Empty yaml file", func(t *testing.T) {
			t.Run("should have not changed repo", func(t *testing.T) {
				dc := newNotificationProvisioner(logger)
				err := dc.applyChanges(emptyFile)
				if err != nil {
					t.Fatalf("applyChanges return an error %v", err)
				}
				notificationsQuery := models.GetAllAlertNotificationsQuery{OrgId: 1}
				err = sqlstore.GetAllAlertNotifications(&notificationsQuery)
				require.NoError(t, err)
				require.Empty(t, notificationsQuery.Result)
			})
		})

		t.Run("Broken yaml should return error", func(t *testing.T) {
			reader := &configReader{log: log.New("test logger")}
			_, err := reader.readConfig(brokenYaml)
			require.Error(t, err)
		})

		t.Run("Skip invalid directory", func(t *testing.T) {
			cfgProvider := &configReader{log: log.New("test logger")}
			cfg, err := cfgProvider.readConfig(emptyFolder)
			if err != nil {
				t.Fatalf("readConfig return an error %v", err)
			}
			require.Equal(t, 0, len(cfg))
		})

		t.Run("Unknown notifier should return error", func(t *testing.T) {
			cfgProvider := &configReader{log: log.New("test logger")}
			_, err := cfgProvider.readConfig(unknownNotifier)
			require.Error(t, err)
			require.Equal(t, `unsupported notification type "nonexisting"`, err.Error())
		})

		t.Run("Read incorrect properties", func(t *testing.T) {
			cfgProvider := &configReader{log: log.New("test logger")}
			_, err := cfgProvider.readConfig(incorrectSettings)
			require.Error(t, err)
			require.Equal(t, "alert validation error: token must be specified when using the Slack chat API", err.Error())
		})
	})
}
