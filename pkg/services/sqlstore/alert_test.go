//go:build integration
// +build integration

package sqlstore

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"

	"github.com/stretchr/testify/require"
)

func mockTimeNow() {
	var timeSeed int64
	timeNow = func() time.Time {
		loc := time.FixedZone("MockZoneUTC-5", -5*60*60)
		fakeNow := time.Unix(timeSeed, 0).In(loc)
		timeSeed++
		return fakeNow
	}
}

func resetTimeNow() {
	timeNow = time.Now
}

func TestIntegrationAlertingDataAccess(t *testing.T) {
	mockTimeNow()
	defer resetTimeNow()

	var sqlStore *SQLStore
	var testDash *models.Dashboard
	var items []*models.Alert

	setup := func(t *testing.T) {
		sqlStore = InitTestDB(t)

		testDash = insertTestDashboard(t, sqlStore, "dashboard with alerts", 1, 0, false, "alert")
		evalData, err := simplejson.NewJson([]byte(`{"test": "test"}`))
		require.Nil(t, err)
		items = []*models.Alert{
			{
				PanelId:     1,
				DashboardId: testDash.Id,
				OrgId:       testDash.OrgId,
				Name:        "Alerting title",
				Message:     "Alerting message",
				Settings:    simplejson.New(),
				Frequency:   1,
				EvalData:    evalData,
			},
		}

		err = sqlStore.SaveAlerts(context.Background(), testDash.Id, items)
		require.Nil(t, err)
	}

	t.Run("Can set new states", func(t *testing.T) {
		setup(t)

		// Get alert so we can use its ID in tests
		alertQuery := models.GetAlertsQuery{DashboardIDs: []int64{testDash.Id}, PanelId: 1, OrgId: 1, User: &models.SignedInUser{OrgRole: models.ROLE_ADMIN}}
		err2 := sqlStore.HandleAlertsQuery(context.Background(), &alertQuery)
		require.Nil(t, err2)

		insertedAlert := alertQuery.Result[0]

		t.Run("new state ok", func(t *testing.T) {
			cmd := &models.SetAlertStateCommand{
				AlertId: insertedAlert.Id,
				State:   models.AlertStateOK,
			}

			err := sqlStore.SetAlertState(context.Background(), cmd)
			require.Nil(t, err)
		})

		alert, _ := getAlertById(t, insertedAlert.Id, sqlStore)
		stateDateBeforePause := alert.NewStateDate

		t.Run("can pause all alerts", func(t *testing.T) {
			err := sqlStore.pauseAllAlerts(t, true)
			require.Nil(t, err)

			t.Run("cannot updated paused alert", func(t *testing.T) {
				cmd := &models.SetAlertStateCommand{
					AlertId: insertedAlert.Id,
					State:   models.AlertStateOK,
				}

				err = sqlStore.SetAlertState(context.Background(), cmd)
				require.Error(t, err)
			})

			t.Run("alert is paused", func(t *testing.T) {
				alert, _ = getAlertById(t, insertedAlert.Id, sqlStore)
				currentState := alert.State
				require.Equal(t, models.AlertStatePaused, currentState)
			})

			t.Run("pausing alerts should update their NewStateDate", func(t *testing.T) {
				alert, _ = getAlertById(t, insertedAlert.Id, sqlStore)
				stateDateAfterPause := alert.NewStateDate
				require.True(t, stateDateBeforePause.Before(stateDateAfterPause))
			})

			t.Run("unpausing alerts should update their NewStateDate again", func(t *testing.T) {
				err := sqlStore.pauseAllAlerts(t, false)
				require.Nil(t, err)
				alert, _ = getAlertById(t, insertedAlert.Id, sqlStore)
				stateDateAfterUnpause := alert.NewStateDate
				require.True(t, stateDateBeforePause.Before(stateDateAfterUnpause))
			})
		})
	})

	t.Run("Can read properties", func(t *testing.T) {
		setup(t)
		alertQuery := models.GetAlertsQuery{DashboardIDs: []int64{testDash.Id}, PanelId: 1, OrgId: 1, User: &models.SignedInUser{OrgRole: models.ROLE_ADMIN}}
		err2 := sqlStore.HandleAlertsQuery(context.Background(), &alertQuery)

		alert := alertQuery.Result[0]
		require.Nil(t, err2)
		require.Greater(t, alert.Id, int64(0))
		require.Equal(t, testDash.Id, alert.DashboardId)
		require.Equal(t, int64(1), alert.PanelId)
		require.Equal(t, "Alerting title", alert.Name)
		require.Equal(t, models.AlertStateUnknown, alert.State)
		require.NotNil(t, alert.NewStateDate)
		require.NotNil(t, alert.EvalData)
		require.Equal(t, "test", alert.EvalData.Get("test").MustString())
		require.NotNil(t, alert.EvalDate)
		require.Equal(t, "", alert.ExecutionError)
		require.NotNil(t, alert.DashboardUid)
		require.Equal(t, "dashboard-with-alerts", alert.DashboardSlug)
	})

	t.Run("Viewer can read alerts", func(t *testing.T) {
		setup(t)
		viewerUser := &models.SignedInUser{OrgRole: models.ROLE_VIEWER, OrgId: 1}
		alertQuery := models.GetAlertsQuery{DashboardIDs: []int64{testDash.Id}, PanelId: 1, OrgId: 1, User: viewerUser}
		err2 := sqlStore.HandleAlertsQuery(context.Background(), &alertQuery)

		require.Nil(t, err2)
		require.Equal(t, 1, len(alertQuery.Result))
	})

	t.Run("Alerts with same dashboard id and panel id should update", func(t *testing.T) {
		setup(t)
		modifiedItems := items
		modifiedItems[0].Name = "Name"

		err := sqlStore.SaveAlerts(context.Background(), testDash.Id, items)

		t.Run("Can save alerts with same dashboard and panel id", func(t *testing.T) {
			require.Nil(t, err)
		})

		t.Run("Alerts should be updated", func(t *testing.T) {
			query := models.GetAlertsQuery{DashboardIDs: []int64{testDash.Id}, OrgId: 1, User: &models.SignedInUser{OrgRole: models.ROLE_ADMIN}}
			err2 := sqlStore.HandleAlertsQuery(context.Background(), &query)

			require.Nil(t, err2)
			require.Equal(t, 1, len(query.Result))
			require.Equal(t, "Name", query.Result[0].Name)

			t.Run("Alert state should not be updated", func(t *testing.T) {
				require.Equal(t, models.AlertStateUnknown, query.Result[0].State)
			})
		})

		t.Run("Updates without changes should be ignored", func(t *testing.T) {
			err3 := sqlStore.SaveAlerts(context.Background(), testDash.Id, items)
			require.Nil(t, err3)
		})
	})

	t.Run("Multiple alerts per dashboard", func(t *testing.T) {
		setup(t)
		multipleItems := []*models.Alert{
			{
				DashboardId: testDash.Id,
				PanelId:     1,
				Name:        "1",
				OrgId:       1,
				Settings:    simplejson.New(),
			},
			{
				DashboardId: testDash.Id,
				PanelId:     2,
				Name:        "2",
				OrgId:       1,
				Settings:    simplejson.New(),
			},
			{
				DashboardId: testDash.Id,
				PanelId:     3,
				Name:        "3",
				OrgId:       1,
				Settings:    simplejson.New(),
			},
		}

		err := sqlStore.SaveAlerts(context.Background(), testDash.Id, multipleItems)

		t.Run("Should save 3 dashboards", func(t *testing.T) {
			require.Nil(t, err)

			queryForDashboard := models.GetAlertsQuery{DashboardIDs: []int64{testDash.Id}, OrgId: 1, User: &models.SignedInUser{OrgRole: models.ROLE_ADMIN}}
			err2 := sqlStore.HandleAlertsQuery(context.Background(), &queryForDashboard)

			require.Nil(t, err2)
			require.Equal(t, 3, len(queryForDashboard.Result))
		})

		t.Run("should updated two dashboards and delete one", func(t *testing.T) {
			missingOneAlert := multipleItems[:2]

			err = sqlStore.SaveAlerts(context.Background(), testDash.Id, missingOneAlert)

			t.Run("should delete the missing alert", func(t *testing.T) {
				query := models.GetAlertsQuery{DashboardIDs: []int64{testDash.Id}, OrgId: 1, User: &models.SignedInUser{OrgRole: models.ROLE_ADMIN}}
				err2 := sqlStore.HandleAlertsQuery(context.Background(), &query)
				require.Nil(t, err2)
				require.Equal(t, 2, len(query.Result))
			})
		})
	})

	t.Run("When dashboard is removed", func(t *testing.T) {
		setup(t)
		items := []*models.Alert{
			{
				PanelId:     1,
				DashboardId: testDash.Id,
				Name:        "Alerting title",
				Message:     "Alerting message",
			},
		}

		err := sqlStore.SaveAlerts(context.Background(), testDash.Id, items)
		require.Nil(t, err)

		err = sqlStore.WithDbSession(context.Background(), func(sess *DBSession) error {
			dash := models.Dashboard{Id: testDash.Id, OrgId: 1}
			_, err := sess.Delete(dash)
			return err
		})
		require.Nil(t, err)

		t.Run("Alerts should be removed", func(t *testing.T) {
			query := models.GetAlertsQuery{DashboardIDs: []int64{testDash.Id}, OrgId: 1, User: &models.SignedInUser{OrgRole: models.ROLE_ADMIN}}
			err2 := sqlStore.HandleAlertsQuery(context.Background(), &query)

			require.Nil(t, err2)
			require.Equal(t, 0, len(query.Result))
		})
	})
}

func TestIntegrationPausingAlerts(t *testing.T) {
	mockTimeNow()
	defer resetTimeNow()

	t.Run("Given an alert", func(t *testing.T) {
		sqlStore := InitTestDB(t)

		testDash := insertTestDashboard(t, sqlStore, "dashboard with alerts", 1, 0, false, "alert")
		alert, err := insertTestAlert("Alerting title", "Alerting message", testDash.OrgId, testDash.Id, simplejson.New(), sqlStore)
		require.Nil(t, err)

		stateDateBeforePause := alert.NewStateDate
		stateDateAfterPause := stateDateBeforePause

		// Get alert so we can use its ID in tests
		alertQuery := models.GetAlertsQuery{DashboardIDs: []int64{testDash.Id}, PanelId: 1, OrgId: 1, User: &models.SignedInUser{OrgRole: models.ROLE_ADMIN}}
		err2 := sqlStore.HandleAlertsQuery(context.Background(), &alertQuery)
		require.Nil(t, err2)

		insertedAlert := alertQuery.Result[0]

		t.Run("when paused", func(t *testing.T) {
			_, err := sqlStore.pauseAlert(t, testDash.OrgId, insertedAlert.Id, true)
			require.Nil(t, err)

			t.Run("the NewStateDate should be updated", func(t *testing.T) {
				alert, err := getAlertById(t, insertedAlert.Id, sqlStore)
				require.Nil(t, err)

				stateDateAfterPause = alert.NewStateDate
				require.True(t, stateDateBeforePause.Before(stateDateAfterPause))
			})
		})

		t.Run("when unpaused", func(t *testing.T) {
			_, err := sqlStore.pauseAlert(t, testDash.OrgId, insertedAlert.Id, false)
			require.Nil(t, err)

			t.Run("the NewStateDate should be updated again", func(t *testing.T) {
				alert, err := getAlertById(t, insertedAlert.Id, sqlStore)
				require.Nil(t, err)

				stateDateAfterUnpause := alert.NewStateDate
				require.True(t, stateDateAfterPause.Before(stateDateAfterUnpause))
			})
		})
	})
}
func (ss *SQLStore) pauseAlert(t *testing.T, orgId int64, alertId int64, pauseState bool) (int64, error) {
	cmd := &models.PauseAlertCommand{
		OrgId:    orgId,
		AlertIds: []int64{alertId},
		Paused:   pauseState,
	}
	err := ss.PauseAlert(context.Background(), cmd)
	require.Nil(t, err)
	return cmd.ResultCount, err
}
func insertTestAlert(title string, message string, orgId int64, dashId int64, settings *simplejson.Json, ss *SQLStore) (*models.Alert, error) {
	items := []*models.Alert{
		{
			PanelId:     1,
			DashboardId: dashId,
			OrgId:       orgId,
			Name:        title,
			Message:     message,
			Settings:    settings,
			Frequency:   1,
		},
	}

	err := ss.SaveAlerts(context.Background(), dashId, items)
	return items[0], err
}

func getAlertById(t *testing.T, id int64, ss *SQLStore) (*models.Alert, error) {
	q := &models.GetAlertByIdQuery{
		Id: id,
	}
	err := ss.GetAlertById(context.Background(), q)
	require.Nil(t, err)
	return q.Result, err
}

func (ss *SQLStore) pauseAllAlerts(t *testing.T, pauseState bool) error {
	cmd := &models.PauseAllAlertCommand{
		Paused: pauseState,
	}
	err := ss.PauseAllAlerts(context.Background(), cmd)
	require.Nil(t, err)
	return err
}
