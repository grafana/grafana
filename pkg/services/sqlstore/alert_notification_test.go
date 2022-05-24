//go:build integration
// +build integration

package sqlstore

import (
	"context"
	"errors"
	"regexp"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"

	"github.com/stretchr/testify/require"
)

func TestIntegrationAlertNotificationSQLAccess(t *testing.T) {
	var sqlStore *SQLStore
	setup := func() { sqlStore = InitTestDB(t) }

	t.Run("Alert notification state", func(t *testing.T) {
		setup()
		var alertID int64 = 7
		var orgID int64 = 5
		var notifierID int64 = 10
		oldTimeNow := timeNow
		now := time.Date(2018, 9, 30, 0, 0, 0, 0, time.UTC)
		timeNow = func() time.Time { return now }

		defer func() { timeNow = oldTimeNow }()

		t.Run("Get no existing state should create a new state", func(t *testing.T) {
			query := &models.GetOrCreateNotificationStateQuery{AlertId: alertID, OrgId: orgID, NotifierId: notifierID}
			err := sqlStore.GetOrCreateAlertNotificationState(context.Background(), query)
			require.Nil(t, err)
			require.NotNil(t, query.Result)
			require.Equal(t, models.AlertNotificationStateUnknown, query.Result.State)
			require.Equal(t, int64(0), query.Result.Version)
			require.Equal(t, now.Unix(), query.Result.UpdatedAt)

			t.Run("Get existing state should not create a new state", func(t *testing.T) {
				query2 := &models.GetOrCreateNotificationStateQuery{AlertId: alertID, OrgId: orgID, NotifierId: notifierID}
				err := sqlStore.GetOrCreateAlertNotificationState(context.Background(), query2)
				require.Nil(t, err)
				require.NotNil(t, query2.Result)
				require.Equal(t, query.Result.Id, query2.Result.Id)
				require.Equal(t, now.Unix(), query2.Result.UpdatedAt)
			})

			t.Run("Update existing state to pending with correct version should update database", func(t *testing.T) {
				s := *query.Result

				cmd := models.SetAlertNotificationStateToPendingCommand{
					Id:                           s.Id,
					Version:                      s.Version,
					AlertRuleStateUpdatedVersion: s.AlertRuleStateUpdatedVersion,
				}

				err := sqlStore.SetAlertNotificationStateToPendingCommand(context.Background(), &cmd)
				require.Nil(t, err)
				require.Equal(t, int64(1), cmd.ResultVersion)

				query2 := &models.GetOrCreateNotificationStateQuery{AlertId: alertID, OrgId: orgID, NotifierId: notifierID}
				err = sqlStore.GetOrCreateAlertNotificationState(context.Background(), query2)
				require.Nil(t, err)
				require.Equal(t, int64(1), query2.Result.Version)
				require.Equal(t, models.AlertNotificationStatePending, query2.Result.State)
				require.Equal(t, now.Unix(), query2.Result.UpdatedAt)

				t.Run("Update existing state to completed should update database", func(t *testing.T) {
					s := *query.Result
					setStateCmd := models.SetAlertNotificationStateToCompleteCommand{
						Id:      s.Id,
						Version: cmd.ResultVersion,
					}
					err := sqlStore.SetAlertNotificationStateToCompleteCommand(context.Background(), &setStateCmd)
					require.Nil(t, err)

					query3 := &models.GetOrCreateNotificationStateQuery{AlertId: alertID, OrgId: orgID, NotifierId: notifierID}
					err = sqlStore.GetOrCreateAlertNotificationState(context.Background(), query3)
					require.Nil(t, err)
					require.Equal(t, int64(2), query3.Result.Version)
					require.Equal(t, models.AlertNotificationStateCompleted, query3.Result.State)
					require.Equal(t, now.Unix(), query3.Result.UpdatedAt)
				})

				t.Run("Update existing state to completed should update database. regardless of version", func(t *testing.T) {
					s := *query.Result
					unknownVersion := int64(1000)
					cmd := models.SetAlertNotificationStateToCompleteCommand{
						Id:      s.Id,
						Version: unknownVersion,
					}
					err := sqlStore.SetAlertNotificationStateToCompleteCommand(context.Background(), &cmd)
					require.Nil(t, err)

					query3 := &models.GetOrCreateNotificationStateQuery{AlertId: alertID, OrgId: orgID, NotifierId: notifierID}
					err = sqlStore.GetOrCreateAlertNotificationState(context.Background(), query3)
					require.Nil(t, err)
					require.Equal(t, unknownVersion+1, query3.Result.Version)
					require.Equal(t, models.AlertNotificationStateCompleted, query3.Result.State)
					require.Equal(t, now.Unix(), query3.Result.UpdatedAt)
				})
			})

			t.Run("Update existing state to pending with incorrect version should return version mismatch error", func(t *testing.T) {
				s := *query.Result
				s.Version = 1000
				cmd := models.SetAlertNotificationStateToPendingCommand{
					Id:                           s.NotifierId,
					Version:                      s.Version,
					AlertRuleStateUpdatedVersion: s.AlertRuleStateUpdatedVersion,
				}
				err := sqlStore.SetAlertNotificationStateToPendingCommand(context.Background(), &cmd)
				require.Equal(t, models.ErrAlertNotificationStateVersionConflict, err)
			})

			t.Run("Updating existing state to pending with incorrect version since alert rule state update version is higher", func(t *testing.T) {
				s := *query.Result
				cmd := models.SetAlertNotificationStateToPendingCommand{
					Id:                           s.Id,
					Version:                      s.Version,
					AlertRuleStateUpdatedVersion: 1000,
				}
				err := sqlStore.SetAlertNotificationStateToPendingCommand(context.Background(), &cmd)
				require.Nil(t, err)

				require.Equal(t, int64(1), cmd.ResultVersion)
			})

			t.Run("different version and same alert state change version should return error", func(t *testing.T) {
				s := *query.Result
				s.Version = 1000
				cmd := models.SetAlertNotificationStateToPendingCommand{
					Id:                           s.Id,
					Version:                      s.Version,
					AlertRuleStateUpdatedVersion: s.AlertRuleStateUpdatedVersion,
				}
				err := sqlStore.SetAlertNotificationStateToPendingCommand(context.Background(), &cmd)
				require.Error(t, err)
			})
		})
	})

	t.Run("Alert notifications should be empty", func(t *testing.T) {
		setup()
		cmd := &models.GetAlertNotificationsQuery{
			OrgId: 2,
			Name:  "email",
		}

		err := sqlStore.GetAlertNotifications(context.Background(), cmd)
		require.Nil(t, err)
		require.Nil(t, cmd.Result)
	})

	t.Run("Cannot save alert notifier with send reminder = true", func(t *testing.T) {
		setup()
		cmd := &models.CreateAlertNotificationCommand{
			Name:         "ops",
			Type:         "email",
			OrgId:        1,
			SendReminder: true,
			Settings:     simplejson.New(),
		}

		t.Run("and missing frequency", func(t *testing.T) {
			err := sqlStore.CreateAlertNotificationCommand(context.Background(), cmd)
			require.Equal(t, models.ErrNotificationFrequencyNotFound, err)
		})

		t.Run("invalid frequency", func(t *testing.T) {
			cmd.Frequency = "invalid duration"
			err := sqlStore.CreateAlertNotificationCommand(context.Background(), cmd)
			require.True(t, regexp.MustCompile(`^time: invalid duration "?invalid duration"?$`).MatchString(
				err.Error()))
		})
	})

	t.Run("Cannot update alert notifier with send reminder = false", func(t *testing.T) {
		setup()
		cmd := &models.CreateAlertNotificationCommand{
			Name:         "ops update",
			Type:         "email",
			OrgId:        1,
			SendReminder: false,
			Settings:     simplejson.New(),
		}

		err := sqlStore.CreateAlertNotificationCommand(context.Background(), cmd)
		require.Nil(t, err)

		updateCmd := &models.UpdateAlertNotificationCommand{
			Id:           cmd.Result.Id,
			SendReminder: true,
		}

		t.Run("and missing frequency", func(t *testing.T) {
			err := sqlStore.UpdateAlertNotification(context.Background(), updateCmd)
			require.Equal(t, models.ErrNotificationFrequencyNotFound, err)
		})

		t.Run("invalid frequency", func(t *testing.T) {
			updateCmd.Frequency = "invalid duration"

			err := sqlStore.UpdateAlertNotification(context.Background(), updateCmd)
			require.Error(t, err)
			require.True(t, regexp.MustCompile(`^time: invalid duration "?invalid duration"?$`).MatchString(
				err.Error()))
		})
	})

	t.Run("Can save Alert Notification", func(t *testing.T) {
		setup()
		cmd := &models.CreateAlertNotificationCommand{
			Name:         "ops",
			Type:         "email",
			OrgId:        1,
			SendReminder: true,
			Frequency:    "10s",
			Settings:     simplejson.New(),
		}

		err := sqlStore.CreateAlertNotificationCommand(context.Background(), cmd)
		require.Nil(t, err)
		require.NotEqual(t, 0, cmd.Result.Id)
		require.NotEqual(t, 0, cmd.Result.OrgId)
		require.Equal(t, "email", cmd.Result.Type)
		require.Equal(t, 10*time.Second, cmd.Result.Frequency)
		require.False(t, cmd.Result.DisableResolveMessage)
		require.NotEmpty(t, cmd.Result.Uid)

		t.Run("Cannot save Alert Notification with the same name", func(t *testing.T) {
			err = sqlStore.CreateAlertNotificationCommand(context.Background(), cmd)
			require.Error(t, err)
		})
		t.Run("Cannot save Alert Notification with the same name and another uid", func(t *testing.T) {
			anotherUidCmd := &models.CreateAlertNotificationCommand{
				Name:         cmd.Name,
				Type:         cmd.Type,
				OrgId:        1,
				SendReminder: cmd.SendReminder,
				Frequency:    cmd.Frequency,
				Settings:     cmd.Settings,
				Uid:          "notifier1",
			}
			err = sqlStore.CreateAlertNotificationCommand(context.Background(), anotherUidCmd)
			require.Error(t, err)
		})
		t.Run("Can save Alert Notification with another name and another uid", func(t *testing.T) {
			anotherUidCmd := &models.CreateAlertNotificationCommand{
				Name:         "another ops",
				Type:         cmd.Type,
				OrgId:        1,
				SendReminder: cmd.SendReminder,
				Frequency:    cmd.Frequency,
				Settings:     cmd.Settings,
				Uid:          "notifier2",
			}
			err = sqlStore.CreateAlertNotificationCommand(context.Background(), anotherUidCmd)
			require.Nil(t, err)
		})

		t.Run("Can update alert notification", func(t *testing.T) {
			newCmd := &models.UpdateAlertNotificationCommand{
				Name:                  "NewName",
				Type:                  "webhook",
				OrgId:                 cmd.Result.OrgId,
				SendReminder:          true,
				DisableResolveMessage: true,
				Frequency:             "60s",
				Settings:              simplejson.New(),
				Id:                    cmd.Result.Id,
			}
			err := sqlStore.UpdateAlertNotification(context.Background(), newCmd)
			require.Nil(t, err)
			require.Equal(t, "NewName", newCmd.Result.Name)
			require.Equal(t, 60*time.Second, newCmd.Result.Frequency)
			require.True(t, newCmd.Result.DisableResolveMessage)
		})

		t.Run("Can update alert notification to disable sending of reminders", func(t *testing.T) {
			newCmd := &models.UpdateAlertNotificationCommand{
				Name:         "NewName",
				Type:         "webhook",
				OrgId:        cmd.Result.OrgId,
				SendReminder: false,
				Settings:     simplejson.New(),
				Id:           cmd.Result.Id,
			}
			err := sqlStore.UpdateAlertNotification(context.Background(), newCmd)
			require.Nil(t, err)
			require.False(t, newCmd.Result.SendReminder)
		})
	})

	t.Run("Can search using an array of ids", func(t *testing.T) {
		setup()
		cmd1 := models.CreateAlertNotificationCommand{Name: "nagios", Type: "webhook", OrgId: 1, SendReminder: true, Frequency: "10s", Settings: simplejson.New()}
		cmd2 := models.CreateAlertNotificationCommand{Name: "slack", Type: "webhook", OrgId: 1, SendReminder: true, Frequency: "10s", Settings: simplejson.New()}
		cmd3 := models.CreateAlertNotificationCommand{Name: "ops2", Type: "email", OrgId: 1, SendReminder: true, Frequency: "10s", Settings: simplejson.New()}
		cmd4 := models.CreateAlertNotificationCommand{IsDefault: true, Name: "default", Type: "email", OrgId: 1, SendReminder: true, Frequency: "10s", Settings: simplejson.New()}

		otherOrg := models.CreateAlertNotificationCommand{Name: "default", Type: "email", OrgId: 2, SendReminder: true, Frequency: "10s", Settings: simplejson.New()}

		require.Nil(t, sqlStore.CreateAlertNotificationCommand(context.Background(), &cmd1))
		require.Nil(t, sqlStore.CreateAlertNotificationCommand(context.Background(), &cmd2))
		require.Nil(t, sqlStore.CreateAlertNotificationCommand(context.Background(), &cmd3))
		require.Nil(t, sqlStore.CreateAlertNotificationCommand(context.Background(), &cmd4))
		require.Nil(t, sqlStore.CreateAlertNotificationCommand(context.Background(), &otherOrg))

		t.Run("search", func(t *testing.T) {
			query := &models.GetAlertNotificationsWithUidToSendQuery{
				Uids:  []string{cmd1.Result.Uid, cmd2.Result.Uid, "112341231"},
				OrgId: 1,
			}

			err := sqlStore.GetAlertNotificationsWithUidToSend(context.Background(), query)
			require.Nil(t, err)
			require.Equal(t, 3, len(query.Result))
		})

		t.Run("all", func(t *testing.T) {
			query := &models.GetAllAlertNotificationsQuery{
				OrgId: 1,
			}

			err := sqlStore.GetAllAlertNotifications(context.Background(), query)
			require.Nil(t, err)
			require.Equal(t, 4, len(query.Result))
			require.Equal(t, cmd4.Name, query.Result[0].Name)
			require.Equal(t, cmd1.Name, query.Result[1].Name)
			require.Equal(t, cmd3.Name, query.Result[2].Name)
			require.Equal(t, cmd2.Name, query.Result[3].Name)
		})
	})

	t.Run("Notification Uid by Id Caching", func(t *testing.T) {
		setup()
		ss := InitTestDB(t)

		notification := &models.CreateAlertNotificationCommand{Uid: "aNotificationUid", OrgId: 1, Name: "aNotificationUid"}
		err := sqlStore.CreateAlertNotificationCommand(context.Background(), notification)
		require.Nil(t, err)

		byUidQuery := &models.GetAlertNotificationsWithUidQuery{
			Uid:   notification.Uid,
			OrgId: notification.OrgId,
		}

		notificationByUidErr := sqlStore.GetAlertNotificationsWithUid(context.Background(), byUidQuery)
		require.Nil(t, notificationByUidErr)

		t.Run("Can cache notification Uid", func(t *testing.T) {
			byIdQuery := &models.GetAlertNotificationUidQuery{
				Id:    byUidQuery.Result.Id,
				OrgId: byUidQuery.Result.OrgId,
			}

			cacheKey := newAlertNotificationUidCacheKey(byIdQuery.OrgId, byIdQuery.Id)

			resultBeforeCaching, foundBeforeCaching := ss.CacheService.Get(cacheKey)
			require.False(t, foundBeforeCaching)
			require.Nil(t, resultBeforeCaching)

			notificationByIdErr := ss.GetAlertNotificationUidWithId(context.Background(), byIdQuery)
			require.Nil(t, notificationByIdErr)

			resultAfterCaching, foundAfterCaching := ss.CacheService.Get(cacheKey)
			require.True(t, foundAfterCaching)
			require.Equal(t, notification.Uid, resultAfterCaching)
		})

		t.Run("Retrieves from cache when exists", func(t *testing.T) {
			query := &models.GetAlertNotificationUidQuery{
				Id:    999,
				OrgId: 100,
			}
			cacheKey := newAlertNotificationUidCacheKey(query.OrgId, query.Id)
			ss.CacheService.Set(cacheKey, "a-cached-uid", -1)

			err := ss.GetAlertNotificationUidWithId(context.Background(), query)
			require.Nil(t, err)
			require.Equal(t, "a-cached-uid", query.Result)
		})

		t.Run("Returns an error without populating cache when the notification doesn't exist in the database", func(t *testing.T) {
			query := &models.GetAlertNotificationUidQuery{
				Id:    -1,
				OrgId: 100,
			}

			err := ss.GetAlertNotificationUidWithId(context.Background(), query)
			require.Equal(t, "", query.Result)
			require.Error(t, err)
			require.True(t, errors.Is(err, models.ErrAlertNotificationFailedTranslateUniqueID))

			cacheKey := newAlertNotificationUidCacheKey(query.OrgId, query.Id)
			result, found := ss.CacheService.Get(cacheKey)
			require.False(t, found)
			require.Nil(t, result)
		})
	})

	t.Run("Cannot update non-existing Alert Notification", func(t *testing.T) {
		setup()
		updateCmd := &models.UpdateAlertNotificationCommand{
			Name:                  "NewName",
			Type:                  "webhook",
			OrgId:                 1,
			SendReminder:          true,
			DisableResolveMessage: true,
			Frequency:             "60s",
			Settings:              simplejson.New(),
			Id:                    1,
		}
		err := sqlStore.UpdateAlertNotification(context.Background(), updateCmd)
		require.Equal(t, models.ErrAlertNotificationNotFound, err)

		t.Run("using UID", func(t *testing.T) {
			updateWithUidCmd := &models.UpdateAlertNotificationWithUidCommand{
				Name:                  "NewName",
				Type:                  "webhook",
				OrgId:                 1,
				SendReminder:          true,
				DisableResolveMessage: true,
				Frequency:             "60s",
				Settings:              simplejson.New(),
				Uid:                   "uid",
				NewUid:                "newUid",
			}
			err := sqlStore.UpdateAlertNotificationWithUid(context.Background(), updateWithUidCmd)
			require.Equal(t, models.ErrAlertNotificationNotFound, err)
		})
	})

	t.Run("Can delete Alert Notification", func(t *testing.T) {
		setup()
		cmd := &models.CreateAlertNotificationCommand{
			Name:         "ops update",
			Type:         "email",
			OrgId:        1,
			SendReminder: false,
			Settings:     simplejson.New(),
		}

		err := sqlStore.CreateAlertNotificationCommand(context.Background(), cmd)
		require.Nil(t, err)

		deleteCmd := &models.DeleteAlertNotificationCommand{
			Id:    cmd.Result.Id,
			OrgId: 1,
		}
		err = sqlStore.DeleteAlertNotification(context.Background(), deleteCmd)
		require.Nil(t, err)

		t.Run("using UID", func(t *testing.T) {
			err := sqlStore.CreateAlertNotificationCommand(context.Background(), cmd)
			require.Nil(t, err)

			deleteWithUidCmd := &models.DeleteAlertNotificationWithUidCommand{
				Uid:   cmd.Result.Uid,
				OrgId: 1,
			}

			err = sqlStore.DeleteAlertNotificationWithUid(context.Background(), deleteWithUidCmd)
			require.Nil(t, err)
			require.Equal(t, cmd.Result.Id, deleteWithUidCmd.DeletedAlertNotificationId)
		})
	})

	t.Run("Cannot delete non-existing Alert Notification", func(t *testing.T) {
		setup()
		deleteCmd := &models.DeleteAlertNotificationCommand{
			Id:    1,
			OrgId: 1,
		}
		err := sqlStore.DeleteAlertNotification(context.Background(), deleteCmd)
		require.Equal(t, models.ErrAlertNotificationNotFound, err)

		t.Run("using UID", func(t *testing.T) {
			deleteWithUidCmd := &models.DeleteAlertNotificationWithUidCommand{
				Uid:   "uid",
				OrgId: 1,
			}
			err = sqlStore.DeleteAlertNotificationWithUid(context.Background(), deleteWithUidCmd)
			require.Equal(t, models.ErrAlertNotificationNotFound, err)
		})
	})
}
