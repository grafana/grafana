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

func TestAlertNotificationSQLAccess(t *testing.T) {
	t.Run("Testing Alert notification sql access", func(t *testing.T) {
		InitTestDB(t)

		t.Run("Alert notification state", func(t *testing.T) {
			var alertID int64 = 7
			var orgID int64 = 5
			var notifierID int64 = 10
			now := time.Date(2018, 9, 30, 0, 0, 0, 0, time.UTC)
			timeNow = func() time.Time { return now }

			t.Run("Get no existing state should create a new state", func(t *testing.T) {
				query := &models.GetOrCreateNotificationStateQuery{AlertId: alertID, OrgId: orgID, NotifierId: notifierID}
				err := GetOrCreateAlertNotificationState(context.Background(), query)
				require.Nil(t, err)
				require.NotNil(t, query.Result)
				require.EqualValues(t, query.Result.State, "unknown")
				require.EqualValues(t, query.Result.Version, 0)
				require.Equal(t, query.Result.UpdatedAt, now.Unix())

				t.Run("Get existing state should not create a new state", func(t *testing.T) {
					query2 := &models.GetOrCreateNotificationStateQuery{AlertId: alertID, OrgId: orgID, NotifierId: notifierID}
					err := GetOrCreateAlertNotificationState(context.Background(), query2)
					require.Nil(t, err)
					require.NotNil(t, query2.Result)
					require.Equal(t, query2.Result.Id, query.Result.Id)
					require.Equal(t, query2.Result.UpdatedAt, now.Unix())
				})

				t.Run("Update existing state to pending with correct version should update database", func(t *testing.T) {
					s := *query.Result

					cmd := models.SetAlertNotificationStateToPendingCommand{
						Id:                           s.Id,
						Version:                      s.Version,
						AlertRuleStateUpdatedVersion: s.AlertRuleStateUpdatedVersion,
					}

					err := SetAlertNotificationStateToPendingCommand(context.Background(), &cmd)
					require.Nil(t, err)
					require.EqualValues(t, cmd.ResultVersion, 1)

					query2 := &models.GetOrCreateNotificationStateQuery{AlertId: alertID, OrgId: orgID, NotifierId: notifierID}
					err = GetOrCreateAlertNotificationState(context.Background(), query2)
					require.Nil(t, err)
					require.EqualValues(t, query2.Result.Version, 1)
					require.Equal(t, query2.Result.State, models.AlertNotificationStatePending)
					require.Equal(t, query2.Result.UpdatedAt, now.Unix())

					t.Run("Update existing state to completed should update database", func(t *testing.T) {
						s := *query.Result
						setStateCmd := models.SetAlertNotificationStateToCompleteCommand{
							Id:      s.Id,
							Version: cmd.ResultVersion,
						}
						err := SetAlertNotificationStateToCompleteCommand(context.Background(), &setStateCmd)
						require.Nil(t, err)

						query3 := &models.GetOrCreateNotificationStateQuery{AlertId: alertID, OrgId: orgID, NotifierId: notifierID}
						err = GetOrCreateAlertNotificationState(context.Background(), query3)
						require.Nil(t, err)
						require.EqualValues(t, query3.Result.Version, 2)
						require.Equal(t, query3.Result.State, models.AlertNotificationStateCompleted)
						require.Equal(t, query3.Result.UpdatedAt, now.Unix())
					})

					t.Run("Update existing state to completed should update database. regardless of version", func(t *testing.T) {
						s := *query.Result
						unknownVersion := int64(1000)
						cmd := models.SetAlertNotificationStateToCompleteCommand{
							Id:      s.Id,
							Version: unknownVersion,
						}
						err := SetAlertNotificationStateToCompleteCommand(context.Background(), &cmd)
						require.Nil(t, err)

						query3 := &models.GetOrCreateNotificationStateQuery{AlertId: alertID, OrgId: orgID, NotifierId: notifierID}
						err = GetOrCreateAlertNotificationState(context.Background(), query3)
						require.Nil(t, err)
						require.Equal(t, query3.Result.Version, unknownVersion+1)
						require.Equal(t, query3.Result.State, models.AlertNotificationStateCompleted)
						require.Equal(t, query3.Result.UpdatedAt, now.Unix())
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
					err := SetAlertNotificationStateToPendingCommand(context.Background(), &cmd)
					require.Equal(t, err, models.ErrAlertNotificationStateVersionConflict)
				})

				t.Run("Updating existing state to pending with incorrect version since alert rule state update version is higher", func(t *testing.T) {
					s := *query.Result
					cmd := models.SetAlertNotificationStateToPendingCommand{
						Id:                           s.Id,
						Version:                      s.Version,
						AlertRuleStateUpdatedVersion: 1000,
					}
					err := SetAlertNotificationStateToPendingCommand(context.Background(), &cmd)
					require.Nil(t, err)

					require.EqualValues(t, cmd.ResultVersion, 1)
				})

				t.Run("different version and same alert state change version should return error", func(t *testing.T) {
					s := *query.Result
					s.Version = 1000
					cmd := models.SetAlertNotificationStateToPendingCommand{
						Id:                           s.Id,
						Version:                      s.Version,
						AlertRuleStateUpdatedVersion: s.AlertRuleStateUpdatedVersion,
					}
					err := SetAlertNotificationStateToPendingCommand(context.Background(), &cmd)
					require.NotNil(t, err)
				})
			})
		})

		t.Run("Alert notifications should be empty", func(t *testing.T) {
			cmd := &models.GetAlertNotificationsQuery{
				OrgId: 2,
				Name:  "email",
			}

			err := GetAlertNotifications(context.Background(), cmd)
			require.Nil(t, err)
			require.Nil(t, cmd.Result)
		})

		t.Run("Cannot save alert notifier with send reminder = true", func(t *testing.T) {
			cmd := &models.CreateAlertNotificationCommand{
				Name:         "ops",
				Type:         "email",
				OrgId:        1,
				SendReminder: true,
				Settings:     simplejson.New(),
			}

			t.Run("and missing frequency", func(t *testing.T) {
				err := CreateAlertNotificationCommand(context.Background(), cmd)
				require.Equal(t, err, models.ErrNotificationFrequencyNotFound)
			})

			t.Run("invalid frequency", func(t *testing.T) {
				cmd.Frequency = "invalid duration"

				err := CreateAlertNotificationCommand(context.Background(), cmd)
				require.True(t, regexp.MustCompile(`^time: invalid duration "?invalid duration"?$`).MatchString(
					err.Error()))
			})
		})

		t.Run("Cannot update alert notifier with send reminder = false", func(t *testing.T) {
			cmd := &models.CreateAlertNotificationCommand{
				Name:         "ops update",
				Type:         "email",
				OrgId:        1,
				SendReminder: false,
				Settings:     simplejson.New(),
			}

			err := CreateAlertNotificationCommand(context.Background(), cmd)
			require.Nil(t, err)

			updateCmd := &models.UpdateAlertNotificationCommand{
				Id:           cmd.Result.Id,
				SendReminder: true,
			}

			t.Run("and missing frequency", func(t *testing.T) {
				err := UpdateAlertNotification(context.Background(), updateCmd)
				require.Equal(t, err, models.ErrNotificationFrequencyNotFound)
			})

			t.Run("invalid frequency", func(t *testing.T) {
				updateCmd.Frequency = "invalid duration"

				err := UpdateAlertNotification(context.Background(), updateCmd)
				require.NotNil(t, err)
				require.True(t, regexp.MustCompile(`^time: invalid duration "?invalid duration"?$`).MatchString(
					err.Error()))
			})
		})

		t.Run("Can save Alert Notification", func(t *testing.T) {
			cmd := &models.CreateAlertNotificationCommand{
				Name:         "ops",
				Type:         "email",
				OrgId:        1,
				SendReminder: true,
				Frequency:    "10s",
				Settings:     simplejson.New(),
			}

			err := CreateAlertNotificationCommand(context.Background(), cmd)
			require.Nil(t, err)
			require.NotEqual(t, cmd.Result.Id, 0)
			require.NotEqual(t, cmd.Result.OrgId, 0)
			require.Equal(t, cmd.Result.Type, "email")
			require.Equal(t, cmd.Result.Frequency, 10*time.Second)
			require.False(t, cmd.Result.DisableResolveMessage)
			require.NotEmpty(t, cmd.Result.Uid)

			t.Run("Cannot save Alert Notification with the same name", func(t *testing.T) {
				err = CreateAlertNotificationCommand(context.Background(), cmd)
				require.NotNil(t, err)
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
				err = CreateAlertNotificationCommand(context.Background(), anotherUidCmd)
				require.NotNil(t, err)
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
				err = CreateAlertNotificationCommand(context.Background(), anotherUidCmd)
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
				err := UpdateAlertNotification(context.Background(), newCmd)
				require.Nil(t, err)
				require.Equal(t, newCmd.Result.Name, "NewName")
				require.Equal(t, newCmd.Result.Frequency, 60*time.Second)
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
				err := UpdateAlertNotification(context.Background(), newCmd)
				require.Nil(t, err)
				require.False(t, newCmd.Result.SendReminder)
			})
		})

		t.Run("Can search using an array of ids", func(t *testing.T) {
			InitTestDB(t)
			cmd1 := models.CreateAlertNotificationCommand{Name: "nagios", Type: "webhook", OrgId: 1, SendReminder: true, Frequency: "10s", Settings: simplejson.New()}
			cmd2 := models.CreateAlertNotificationCommand{Name: "slack", Type: "webhook", OrgId: 1, SendReminder: true, Frequency: "10s", Settings: simplejson.New()}
			cmd3 := models.CreateAlertNotificationCommand{Name: "ops2", Type: "email", OrgId: 1, SendReminder: true, Frequency: "10s", Settings: simplejson.New()}
			cmd4 := models.CreateAlertNotificationCommand{IsDefault: true, Name: "default", Type: "email", OrgId: 1, SendReminder: true, Frequency: "10s", Settings: simplejson.New()}

			otherOrg := models.CreateAlertNotificationCommand{Name: "default", Type: "email", OrgId: 2, SendReminder: true, Frequency: "10s", Settings: simplejson.New()}

			require.Nil(t, CreateAlertNotificationCommand(context.Background(), &cmd1))
			require.Nil(t, CreateAlertNotificationCommand(context.Background(), &cmd2))
			require.Nil(t, CreateAlertNotificationCommand(context.Background(), &cmd3))
			require.Nil(t, CreateAlertNotificationCommand(context.Background(), &cmd4))
			require.Nil(t, CreateAlertNotificationCommand(context.Background(), &otherOrg))

			t.Run("search", func(t *testing.T) {
				query := &models.GetAlertNotificationsWithUidToSendQuery{
					Uids:  []string{cmd1.Result.Uid, cmd2.Result.Uid, "112341231"},
					OrgId: 1,
				}

				err := GetAlertNotificationsWithUidToSend(context.Background(), query)
				require.Nil(t, err)
				require.Equal(t, len(query.Result), 3)
			})

			t.Run("all", func(t *testing.T) {
				query := &models.GetAllAlertNotificationsQuery{
					OrgId: 1,
				}

				err := GetAllAlertNotifications(context.Background(), query)
				require.Nil(t, err)
				require.Equal(t, len(query.Result), 4)
				require.Equal(t, query.Result[0].Name, cmd4.Name)
				require.Equal(t, query.Result[1].Name, cmd1.Name)
				require.Equal(t, query.Result[2].Name, cmd3.Name)
				require.Equal(t, query.Result[3].Name, cmd2.Name)
			})
		})

		t.Run("Notification Uid by Id Caching", func(t *testing.T) {
			ss := InitTestDB(t)

			notification := &models.CreateAlertNotificationCommand{Uid: "aNotificationUid", OrgId: 1, Name: "aNotificationUid"}
			err := CreateAlertNotificationCommand(context.Background(), notification)
			require.Nil(t, err)

			byUidQuery := &models.GetAlertNotificationsWithUidQuery{
				Uid:   notification.Uid,
				OrgId: notification.OrgId,
			}

			notificationByUidErr := GetAlertNotificationsWithUid(context.Background(), byUidQuery)
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
				require.Equal(t, resultAfterCaching, notification.Uid)
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
				require.Equal(t, query.Result, "a-cached-uid")
			})

			t.Run("Returns an error without populating cache when the notification doesn't exist in the database", func(t *testing.T) {
				query := &models.GetAlertNotificationUidQuery{
					Id:    -1,
					OrgId: 100,
				}

				err := ss.GetAlertNotificationUidWithId(context.Background(), query)
				require.Equal(t, query.Result, "")
				require.NotNil(t, err)
				require.True(t, errors.Is(err, models.ErrAlertNotificationFailedTranslateUniqueID))

				cacheKey := newAlertNotificationUidCacheKey(query.OrgId, query.Id)
				result, found := ss.CacheService.Get(cacheKey)
				require.False(t, found)
				require.Nil(t, result)
			})
		})

		t.Run("Cannot update non-existing Alert Notification", func(t *testing.T) {
			InitTestDB(t)
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
			err := UpdateAlertNotification(context.Background(), updateCmd)
			require.Error(t, err, models.ErrAlertNotificationNotFound)

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
				err := UpdateAlertNotificationWithUid(context.Background(), updateWithUidCmd)
				require.Error(t, err, models.ErrAlertNotificationNotFound)
			})
		})

		t.Run("Can delete Alert Notification", func(t *testing.T) {
			cmd := &models.CreateAlertNotificationCommand{
				Name:         "ops update",
				Type:         "email",
				OrgId:        1,
				SendReminder: false,
				Settings:     simplejson.New(),
			}

			err := CreateAlertNotificationCommand(context.Background(), cmd)
			require.Nil(t, err)

			deleteCmd := &models.DeleteAlertNotificationCommand{
				Id:    cmd.Result.Id,
				OrgId: 1,
			}
			err = DeleteAlertNotification(context.Background(), deleteCmd)
			require.Nil(t, err)

			t.Run("using UID", func(t *testing.T) {
				err := CreateAlertNotificationCommand(context.Background(), cmd)
				require.Nil(t, err)

				deleteWithUidCmd := &models.DeleteAlertNotificationWithUidCommand{
					Uid:   cmd.Result.Uid,
					OrgId: 1,
				}
				err = DeleteAlertNotificationWithUid(context.Background(), deleteWithUidCmd)
				require.Nil(t, err)
				require.Equal(t, deleteWithUidCmd.DeletedAlertNotificationId, cmd.Result.Id)
			})
		})

		t.Run("Cannot delete non-existing Alert Notification", func(t *testing.T) {
			InitTestDB(t)
			deleteCmd := &models.DeleteAlertNotificationCommand{
				Id:    1,
				OrgId: 1,
			}
			err := DeleteAlertNotification(context.Background(), deleteCmd)
			require.Error(t, err, models.ErrAlertNotificationNotFound)

			t.Run("using UID", func(t *testing.T) {
				deleteWithUidCmd := &models.DeleteAlertNotificationWithUidCommand{
					Uid:   "uid",
					OrgId: 1,
				}
				err = DeleteAlertNotificationWithUid(context.Background(), deleteWithUidCmd)
				require.Equal(t, err, models.ErrAlertNotificationNotFound)
			})
		})
	})
}
