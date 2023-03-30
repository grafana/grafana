package alerting

import (
	"context"
	"errors"
	"regexp"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/alerting/models"
)

func TestIntegrationAlertNotificationSQLAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	var store *sqlStore
	setup := func() {
		store = &sqlStore{
			db:    db.InitTestDB(t),
			log:   log.New(),
			cache: localcache.New(time.Minute, time.Minute)}
	}

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
			query := &models.GetOrCreateNotificationStateQuery{AlertID: alertID, OrgID: orgID, NotifierID: notifierID}
			res, err := store.GetOrCreateAlertNotificationState(context.Background(), query)
			require.Nil(t, err)
			require.NotNil(t, res)
			require.Equal(t, models.AlertNotificationStateUnknown, res.State)
			require.Equal(t, int64(0), res.Version)
			require.Equal(t, now.Unix(), res.UpdatedAt)

			t.Run("Get existing state should not create a new state", func(t *testing.T) {
				query2 := &models.GetOrCreateNotificationStateQuery{AlertID: alertID, OrgID: orgID, NotifierID: notifierID}
				res2, err := store.GetOrCreateAlertNotificationState(context.Background(), query2)
				require.Nil(t, err)
				require.NotNil(t, res2)
				require.Equal(t, res.ID, res2.ID)
				require.Equal(t, now.Unix(), res2.UpdatedAt)
			})

			t.Run("Update existing state to pending with correct version should update database", func(t *testing.T) {
				s := *res

				cmd := models.SetAlertNotificationStateToPendingCommand{
					ID:                           s.ID,
					Version:                      s.Version,
					AlertRuleStateUpdatedVersion: s.AlertRuleStateUpdatedVersion,
				}

				err := store.SetAlertNotificationStateToPendingCommand(context.Background(), &cmd)
				require.Nil(t, err)
				require.Equal(t, int64(1), cmd.ResultVersion)

				query2 := &models.GetOrCreateNotificationStateQuery{AlertID: alertID, OrgID: orgID, NotifierID: notifierID}
				res2, err := store.GetOrCreateAlertNotificationState(context.Background(), query2)
				require.Nil(t, err)
				require.Equal(t, int64(1), res2.Version)
				require.Equal(t, models.AlertNotificationStatePending, res2.State)
				require.Equal(t, now.Unix(), res2.UpdatedAt)

				t.Run("Update existing state to completed should update database", func(t *testing.T) {
					s := *res
					setStateCmd := models.SetAlertNotificationStateToCompleteCommand{
						ID:      s.ID,
						Version: cmd.ResultVersion,
					}
					err := store.SetAlertNotificationStateToCompleteCommand(context.Background(), &setStateCmd)
					require.Nil(t, err)

					query3 := &models.GetOrCreateNotificationStateQuery{AlertID: alertID, OrgID: orgID, NotifierID: notifierID}
					res3, err := store.GetOrCreateAlertNotificationState(context.Background(), query3)
					require.Nil(t, err)
					require.Equal(t, int64(2), res3.Version)
					require.Equal(t, models.AlertNotificationStateCompleted, res3.State)
					require.Equal(t, now.Unix(), res3.UpdatedAt)
				})

				t.Run("Update existing state to completed should update database. regardless of version", func(t *testing.T) {
					s := *res
					unknownVersion := int64(1000)
					cmd := models.SetAlertNotificationStateToCompleteCommand{
						ID:      s.ID,
						Version: unknownVersion,
					}
					err := store.SetAlertNotificationStateToCompleteCommand(context.Background(), &cmd)
					require.Nil(t, err)

					query3 := &models.GetOrCreateNotificationStateQuery{AlertID: alertID, OrgID: orgID, NotifierID: notifierID}
					res3, err := store.GetOrCreateAlertNotificationState(context.Background(), query3)
					require.Nil(t, err)
					require.Equal(t, unknownVersion+1, res3.Version)
					require.Equal(t, models.AlertNotificationStateCompleted, res3.State)
					require.Equal(t, now.Unix(), res3.UpdatedAt)
				})
			})

			t.Run("Update existing state to pending with incorrect version should return version mismatch error", func(t *testing.T) {
				s := *res
				s.Version = 1000
				cmd := models.SetAlertNotificationStateToPendingCommand{
					ID:                           s.NotifierID,
					Version:                      s.Version,
					AlertRuleStateUpdatedVersion: s.AlertRuleStateUpdatedVersion,
				}
				err := store.SetAlertNotificationStateToPendingCommand(context.Background(), &cmd)
				require.Equal(t, models.ErrAlertNotificationStateVersionConflict, err)
			})

			t.Run("Updating existing state to pending with incorrect version since alert rule state update version is higher", func(t *testing.T) {
				s := *res
				cmd := models.SetAlertNotificationStateToPendingCommand{
					ID:                           s.ID,
					Version:                      s.Version,
					AlertRuleStateUpdatedVersion: 1000,
				}
				err := store.SetAlertNotificationStateToPendingCommand(context.Background(), &cmd)
				require.Nil(t, err)

				require.Equal(t, int64(1), cmd.ResultVersion)
			})

			t.Run("different version and same alert state change version should return error", func(t *testing.T) {
				s := *res
				s.Version = 1000
				cmd := models.SetAlertNotificationStateToPendingCommand{
					ID:                           s.ID,
					Version:                      s.Version,
					AlertRuleStateUpdatedVersion: s.AlertRuleStateUpdatedVersion,
				}
				err := store.SetAlertNotificationStateToPendingCommand(context.Background(), &cmd)
				require.Error(t, err)
			})
		})
	})

	t.Run("Alert notifications should be empty", func(t *testing.T) {
		setup()
		cmd := &models.GetAlertNotificationsQuery{
			OrgID: 2,
			Name:  "email",
		}

		res, err := store.GetAlertNotifications(context.Background(), cmd)
		require.Nil(t, err)
		require.Nil(t, res)
	})

	t.Run("Cannot save alert notifier with send reminder = true", func(t *testing.T) {
		setup()
		cmd := &models.CreateAlertNotificationCommand{
			Name:         "ops",
			Type:         "email",
			OrgID:        1,
			SendReminder: true,
			Settings:     simplejson.New(),
		}

		t.Run("and missing frequency", func(t *testing.T) {
			_, err := store.CreateAlertNotificationCommand(context.Background(), cmd)
			require.Equal(t, models.ErrNotificationFrequencyNotFound, err)
		})

		t.Run("invalid frequency", func(t *testing.T) {
			cmd.Frequency = "invalid duration"
			_, err := store.CreateAlertNotificationCommand(context.Background(), cmd)
			require.True(t, regexp.MustCompile(`^time: invalid duration "?invalid duration"?$`).MatchString(
				err.Error()))
		})
	})

	t.Run("Cannot update alert notifier with send reminder = false", func(t *testing.T) {
		setup()
		cmd := &models.CreateAlertNotificationCommand{
			Name:         "ops update",
			Type:         "email",
			OrgID:        1,
			SendReminder: false,
			Settings:     simplejson.New(),
		}

		res, err := store.CreateAlertNotificationCommand(context.Background(), cmd)
		require.Nil(t, err)

		updateCmd := &models.UpdateAlertNotificationCommand{
			ID:           res.ID,
			SendReminder: true,
		}

		t.Run("and missing frequency", func(t *testing.T) {
			_, err := store.UpdateAlertNotification(context.Background(), updateCmd)
			require.Equal(t, models.ErrNotificationFrequencyNotFound, err)
		})

		t.Run("invalid frequency", func(t *testing.T) {
			updateCmd.Frequency = "invalid duration"

			_, err := store.UpdateAlertNotification(context.Background(), updateCmd)
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
			OrgID:        1,
			SendReminder: true,
			Frequency:    "10s",
			Settings:     simplejson.New(),
		}

		res, err := store.CreateAlertNotificationCommand(context.Background(), cmd)
		require.Nil(t, err)
		require.NotEqual(t, 0, res.ID)
		require.NotEqual(t, 0, res.OrgID)
		require.Equal(t, "email", res.Type)
		require.Equal(t, 10*time.Second, res.Frequency)
		require.False(t, res.DisableResolveMessage)
		require.NotEmpty(t, res.UID)

		t.Run("Cannot save Alert Notification with the same name", func(t *testing.T) {
			_, err = store.CreateAlertNotificationCommand(context.Background(), cmd)
			require.Error(t, err)
		})
		t.Run("Cannot save Alert Notification with the same name and another uid", func(t *testing.T) {
			anotherUidCmd := &models.CreateAlertNotificationCommand{
				Name:         cmd.Name,
				Type:         cmd.Type,
				OrgID:        1,
				SendReminder: cmd.SendReminder,
				Frequency:    cmd.Frequency,
				Settings:     cmd.Settings,
				UID:          "notifier1",
			}
			_, err = store.CreateAlertNotificationCommand(context.Background(), anotherUidCmd)
			require.Error(t, err)
		})
		t.Run("Can save Alert Notification with another name and another uid", func(t *testing.T) {
			anotherUidCmd := &models.CreateAlertNotificationCommand{
				Name:         "another ops",
				Type:         cmd.Type,
				OrgID:        1,
				SendReminder: cmd.SendReminder,
				Frequency:    cmd.Frequency,
				Settings:     cmd.Settings,
				UID:          "notifier2",
			}
			_, err = store.CreateAlertNotificationCommand(context.Background(), anotherUidCmd)
			require.Nil(t, err)
		})

		t.Run("Can update alert notification", func(t *testing.T) {
			newCmd := &models.UpdateAlertNotificationCommand{
				Name:                  "NewName",
				Type:                  "webhook",
				OrgID:                 res.OrgID,
				SendReminder:          true,
				DisableResolveMessage: true,
				Frequency:             "60s",
				Settings:              simplejson.New(),
				ID:                    res.ID,
			}
			newres, err := store.UpdateAlertNotification(context.Background(), newCmd)
			require.Nil(t, err)
			require.Equal(t, "NewName", newres.Name)
			require.Equal(t, time.Minute, newres.Frequency)
			require.True(t, newres.DisableResolveMessage)
		})

		t.Run("Can update alert notification to disable sending of reminders", func(t *testing.T) {
			newCmd := &models.UpdateAlertNotificationCommand{
				Name:         "NewName",
				Type:         "webhook",
				OrgID:        res.OrgID,
				SendReminder: false,
				Settings:     simplejson.New(),
				ID:           res.ID,
			}
			newres, err := store.UpdateAlertNotification(context.Background(), newCmd)
			require.Nil(t, err)
			require.False(t, newres.SendReminder)
		})
	})

	t.Run("Can search using an array of ids", func(t *testing.T) {
		setup()
		cmd1 := models.CreateAlertNotificationCommand{Name: "nagios", Type: "webhook", OrgID: 1, SendReminder: true, Frequency: "10s", Settings: simplejson.New()}
		cmd2 := models.CreateAlertNotificationCommand{Name: "slack", Type: "webhook", OrgID: 1, SendReminder: true, Frequency: "10s", Settings: simplejson.New()}
		cmd3 := models.CreateAlertNotificationCommand{Name: "ops2", Type: "email", OrgID: 1, SendReminder: true, Frequency: "10s", Settings: simplejson.New()}
		cmd4 := models.CreateAlertNotificationCommand{IsDefault: true, Name: "default", Type: "email", OrgID: 1, SendReminder: true, Frequency: "10s", Settings: simplejson.New()}

		otherOrg := models.CreateAlertNotificationCommand{Name: "default", Type: "email", OrgID: 2, SendReminder: true, Frequency: "10s", Settings: simplejson.New()}

		res1, err := store.CreateAlertNotificationCommand(context.Background(), &cmd1)
		require.NoError(t, err)
		res2, err := store.CreateAlertNotificationCommand(context.Background(), &cmd2)
		require.NoError(t, err)
		_, err = store.CreateAlertNotificationCommand(context.Background(), &cmd3)
		require.NoError(t, err)
		_, err = store.CreateAlertNotificationCommand(context.Background(), &cmd4)
		require.NoError(t, err)
		_, err = store.CreateAlertNotificationCommand(context.Background(), &otherOrg)
		require.NoError(t, err)

		t.Run("search", func(t *testing.T) {
			query := &models.GetAlertNotificationsWithUidToSendQuery{
				UIDs:  []string{res1.UID, res2.UID, "112341231"},
				OrgID: 1,
			}

			res, err := store.GetAlertNotificationsWithUidToSend(context.Background(), query)
			require.Nil(t, err)
			require.Equal(t, 3, len(res))
		})

		t.Run("all", func(t *testing.T) {
			query := &models.GetAllAlertNotificationsQuery{
				OrgID: 1,
			}

			res, err := store.GetAllAlertNotifications(context.Background(), query)
			require.Nil(t, err)
			require.Equal(t, 4, len(res))
			require.Equal(t, cmd4.Name, res[0].Name)
			require.Equal(t, cmd1.Name, res[1].Name)
			require.Equal(t, cmd3.Name, res[2].Name)
			require.Equal(t, cmd2.Name, res[3].Name)
		})
	})

	t.Run("Notification UID by ID Caching", func(t *testing.T) {
		setup()

		notification := &models.CreateAlertNotificationCommand{UID: "aNotificationUid", OrgID: 1, Name: "aNotificationUid"}
		_, err := store.CreateAlertNotificationCommand(context.Background(), notification)
		require.Nil(t, err)

		byUidQuery := &models.GetAlertNotificationsWithUidQuery{
			UID:   notification.UID,
			OrgID: notification.OrgID,
		}

		res, notificationByUidErr := store.GetAlertNotificationsWithUid(context.Background(), byUidQuery)
		require.Nil(t, notificationByUidErr)

		t.Run("Can cache notification UID", func(t *testing.T) {
			byIdQuery := &models.GetAlertNotificationUidQuery{
				ID:    res.ID,
				OrgID: res.OrgID,
			}

			cacheKey := newAlertNotificationUidCacheKey(byIdQuery.OrgID, byIdQuery.ID)

			resultBeforeCaching, foundBeforeCaching := store.cache.Get(cacheKey)
			require.False(t, foundBeforeCaching)
			require.Nil(t, resultBeforeCaching)

			_, notificationByIdErr := store.GetAlertNotificationUidWithId(context.Background(), byIdQuery)
			require.Nil(t, notificationByIdErr)

			resultAfterCaching, foundAfterCaching := store.cache.Get(cacheKey)
			require.True(t, foundAfterCaching)
			require.Equal(t, notification.UID, resultAfterCaching)
		})

		t.Run("Retrieves from cache when exists", func(t *testing.T) {
			query := &models.GetAlertNotificationUidQuery{
				ID:    999,
				OrgID: 100,
			}
			cacheKey := newAlertNotificationUidCacheKey(query.OrgID, query.ID)
			store.cache.Set(cacheKey, "a-cached-uid", -1)

			res, err := store.GetAlertNotificationUidWithId(context.Background(), query)
			require.Nil(t, err)
			require.Equal(t, "a-cached-uid", res)
		})

		t.Run("Returns an error without populating cache when the notification doesn't exist in the database", func(t *testing.T) {
			query := &models.GetAlertNotificationUidQuery{
				ID:    -1,
				OrgID: 100,
			}

			res, err := store.GetAlertNotificationUidWithId(context.Background(), query)
			require.Equal(t, "", res)
			require.Error(t, err)
			require.True(t, errors.Is(err, models.ErrAlertNotificationFailedTranslateUniqueID))

			cacheKey := newAlertNotificationUidCacheKey(query.OrgID, query.ID)
			result, found := store.cache.Get(cacheKey)
			require.False(t, found)
			require.Nil(t, result)
		})
	})

	t.Run("Cannot update non-existing Alert Notification", func(t *testing.T) {
		setup()
		updateCmd := &models.UpdateAlertNotificationCommand{
			Name:                  "NewName",
			Type:                  "webhook",
			OrgID:                 1,
			SendReminder:          true,
			DisableResolveMessage: true,
			Frequency:             "60s",
			Settings:              simplejson.New(),
			ID:                    1,
		}
		_, err := store.UpdateAlertNotification(context.Background(), updateCmd)
		require.Equal(t, models.ErrAlertNotificationNotFound, err)

		t.Run("using UID", func(t *testing.T) {
			updateWithUidCmd := &models.UpdateAlertNotificationWithUidCommand{
				Name:                  "NewName",
				Type:                  "webhook",
				OrgID:                 1,
				SendReminder:          true,
				DisableResolveMessage: true,
				Frequency:             "60s",
				Settings:              simplejson.New(),
				UID:                   "uid",
				NewUID:                "newUid",
			}
			_, err := store.UpdateAlertNotificationWithUid(context.Background(), updateWithUidCmd)
			require.Equal(t, models.ErrAlertNotificationNotFound, err)
		})
	})

	t.Run("Can delete Alert Notification", func(t *testing.T) {
		setup()
		cmd := &models.CreateAlertNotificationCommand{
			Name:         "ops update",
			Type:         "email",
			OrgID:        1,
			SendReminder: false,
			Settings:     simplejson.New(),
		}

		res, err := store.CreateAlertNotificationCommand(context.Background(), cmd)
		require.Nil(t, err)

		deleteCmd := &models.DeleteAlertNotificationCommand{
			ID:    res.ID,
			OrgID: 1,
		}
		err = store.DeleteAlertNotification(context.Background(), deleteCmd)
		require.Nil(t, err)

		t.Run("using UID", func(t *testing.T) {
			res, err := store.CreateAlertNotificationCommand(context.Background(), cmd)
			require.Nil(t, err)

			deleteWithUidCmd := &models.DeleteAlertNotificationWithUidCommand{
				UID:   res.UID,
				OrgID: 1,
			}

			err = store.DeleteAlertNotificationWithUid(context.Background(), deleteWithUidCmd)
			require.Nil(t, err)
			require.Equal(t, res.ID, deleteWithUidCmd.DeletedAlertNotificationID)
		})
	})

	t.Run("Cannot delete non-existing Alert Notification", func(t *testing.T) {
		setup()
		deleteCmd := &models.DeleteAlertNotificationCommand{
			ID:    1,
			OrgID: 1,
		}
		err := store.DeleteAlertNotification(context.Background(), deleteCmd)
		require.Equal(t, models.ErrAlertNotificationNotFound, err)

		t.Run("using UID", func(t *testing.T) {
			deleteWithUidCmd := &models.DeleteAlertNotificationWithUidCommand{
				UID:   "uid",
				OrgID: 1,
			}
			err = store.DeleteAlertNotificationWithUid(context.Background(), deleteWithUidCmd)
			require.Equal(t, models.ErrAlertNotificationNotFound, err)
		})
	})
}
