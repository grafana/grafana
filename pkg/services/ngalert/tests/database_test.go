// +build integration

package tests

import (
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"

	"github.com/grafana/grafana/pkg/registry"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const baseIntervalSeconds = 10

func mockTimeNow() {
	var timeSeed int64
	store.TimeNow = func() time.Time {
		fakeNow := time.Unix(timeSeed, 0).UTC()
		timeSeed++
		return fakeNow
	}
}

func resetTimeNow() {
	store.TimeNow = time.Now
}

func TestCreatingAlertDefinition(t *testing.T) {
	mockTimeNow()
	defer resetTimeNow()

	dbstore := setupTestEnv(t, baseIntervalSeconds)
	t.Cleanup(registry.ClearOverrides)

	var customIntervalSeconds int64 = 120
	testCases := []struct {
		desc                 string
		inputIntervalSeconds *int64
		inputTitle           string
		expectedError        error
		expectedInterval     int64

		expectedUpdated time.Time
	}{
		{
			desc:                 "should create successfully an alert definition with default interval",
			inputIntervalSeconds: nil,
			inputTitle:           "a name",
			expectedInterval:     dbstore.DefaultIntervalSeconds,
			expectedUpdated:      time.Unix(0, 0).UTC(),
		},
		{
			desc:                 "should create successfully an alert definition with custom interval",
			inputIntervalSeconds: &customIntervalSeconds,
			inputTitle:           "another name",
			expectedInterval:     customIntervalSeconds,
			expectedUpdated:      time.Unix(1, 0).UTC(),
		},
		{
			desc:                 "should fail to create an alert definition with too big name",
			inputIntervalSeconds: &customIntervalSeconds,
			inputTitle:           getLongString(store.AlertDefinitionMaxTitleLength + 1),
			expectedError:        errors.New(""),
		},
		{
			desc:                 "should fail to create an alert definition with empty title",
			inputIntervalSeconds: &customIntervalSeconds,
			inputTitle:           "",
			expectedError:        store.ErrEmptyTitleError,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {

			q := models.SaveAlertDefinitionCommand{
				OrgID:     1,
				Title:     tc.inputTitle,
				Condition: "B",
				Data: []models.AlertQuery{
					{
						Model: json.RawMessage(`{
								"datasourceUid": "-100",
								"type":"math",
								"expression":"2 + 3 > 1"
							}`),
						RefID: "B",
						RelativeTimeRange: models.RelativeTimeRange{
							From: models.Duration(time.Duration(5) * time.Hour),
							To:   models.Duration(time.Duration(3) * time.Hour),
						},
					},
				},
			}
			if tc.inputIntervalSeconds != nil {
				q.IntervalSeconds = tc.inputIntervalSeconds
			}
			err := dbstore.SaveAlertDefinition(&q)
			switch {
			case tc.expectedError != nil:
				require.Error(t, err)
			default:
				require.NoError(t, err)
				assert.Equal(t, tc.expectedUpdated, q.Result.Updated)
				assert.Equal(t, tc.expectedInterval, q.Result.IntervalSeconds)
				assert.Equal(t, int64(1), q.Result.Version)

			}
		})
	}
}
func TestCreatingConflictionAlertDefinition(t *testing.T) {
	t.Run("Should fail to create alert definition with conflicting org_id, title", func(t *testing.T) {
		dbstore := setupTestEnv(t, baseIntervalSeconds)
		t.Cleanup(registry.ClearOverrides)

		q := models.SaveAlertDefinitionCommand{
			OrgID:     1,
			Title:     "title",
			Condition: "B",
			Data: []models.AlertQuery{
				{
					Model: json.RawMessage(`{
								"datasourceUid": "-100",
								"type":"math",
								"expression":"2 + 3 > 1"
							}`),
					RefID: "B",
					RelativeTimeRange: models.RelativeTimeRange{
						From: models.Duration(time.Duration(5) * time.Hour),
						To:   models.Duration(time.Duration(3) * time.Hour),
					},
				},
			},
		}

		err := dbstore.SaveAlertDefinition(&q)
		require.NoError(t, err)

		err = dbstore.SaveAlertDefinition(&q)
		require.Error(t, err)
		assert.True(t, dbstore.SQLStore.Dialect.IsUniqueConstraintViolation(err))
	})
}

func TestUpdatingAlertDefinition(t *testing.T) {
	t.Run("zero rows affected when updating unknown alert", func(t *testing.T) {
		mockTimeNow()
		defer resetTimeNow()

		dbstore := setupTestEnv(t, baseIntervalSeconds)
		t.Cleanup(registry.ClearOverrides)

		q := models.UpdateAlertDefinitionCommand{
			UID:       "unknown",
			OrgID:     1,
			Title:     "something completely different",
			Condition: "A",
			Data: []models.AlertQuery{
				{
					Model: json.RawMessage(`{
							"datasourceUid": "-100",
							"type":"math",
							"expression":"2 + 2 > 1"
						}`),
					RefID: "A",
					RelativeTimeRange: models.RelativeTimeRange{
						From: models.Duration(time.Duration(5) * time.Hour),
						To:   models.Duration(time.Duration(3) * time.Hour),
					},
				},
			},
		}

		err := dbstore.UpdateAlertDefinition(&q)
		require.NoError(t, err)
	})

	t.Run("updating existing alert", func(t *testing.T) {
		mockTimeNow()
		defer resetTimeNow()

		dbstore := setupTestEnv(t, baseIntervalSeconds)
		t.Cleanup(registry.ClearOverrides)

		var initialInterval int64 = 120
		alertDefinition := createTestAlertDefinition(t, dbstore, initialInterval)
		created := alertDefinition.Updated

		var customInterval int64 = 30
		testCases := []struct {
			desc                    string
			inputOrgID              int64
			inputTitle              string
			inputInterval           *int64
			expectedError           error
			expectedIntervalSeconds int64
			expectedUpdated         time.Time
			expectedTitle           string
		}{
			{
				desc:                    "should not update previous interval if it's not provided",
				inputInterval:           nil,
				inputOrgID:              alertDefinition.OrgID,
				inputTitle:              "something completely different",
				expectedIntervalSeconds: initialInterval,
				expectedUpdated:         time.Unix(1, 0).UTC(),
				expectedTitle:           "something completely different",
			},
			{
				desc:                    "should update interval if it's provided",
				inputInterval:           &customInterval,
				inputOrgID:              alertDefinition.OrgID,
				inputTitle:              "something completely different",
				expectedIntervalSeconds: customInterval,
				expectedUpdated:         time.Unix(2, 0).UTC(),
				expectedTitle:           "something completely different",
			},
			{
				desc:                    "should not update organisation if it's provided",
				inputInterval:           &customInterval,
				inputOrgID:              0,
				inputTitle:              "something completely different",
				expectedIntervalSeconds: customInterval,
				expectedUpdated:         time.Unix(3, 0).UTC(),
				expectedTitle:           "something completely different",
			},
			{
				desc:          "should not update alert definition if the title it's too big",
				inputInterval: &customInterval,
				inputOrgID:    0,
				inputTitle:    getLongString(store.AlertDefinitionMaxTitleLength + 1),
				expectedError: errors.New(""),
			},
			{
				desc:                    "should not update alert definition title if the title is empty",
				inputInterval:           &customInterval,
				inputOrgID:              0,
				inputTitle:              "",
				expectedIntervalSeconds: customInterval,
				expectedUpdated:         time.Unix(4, 0).UTC(),
				expectedTitle:           "something completely different",
			},
		}

		q := models.UpdateAlertDefinitionCommand{
			UID:       (*alertDefinition).UID,
			Condition: "B",
			Data: []models.AlertQuery{
				{
					Model: json.RawMessage(`{
							"datasourceUid": "-100",
							"type":"math",
							"expression":"2 + 3 > 1"
						}`),
					RefID: "B",
					RelativeTimeRange: models.RelativeTimeRange{
						From: models.Duration(5 * time.Hour),
						To:   models.Duration(3 * time.Hour),
					},
				},
			},
		}

		lastUpdated := created
		previousAlertDefinition := alertDefinition
		for _, tc := range testCases {
			t.Run(tc.desc, func(t *testing.T) {
				if tc.inputInterval != nil {
					q.IntervalSeconds = tc.inputInterval
				}
				if tc.inputOrgID != 0 {
					q.OrgID = tc.inputOrgID
				}
				q.Title = tc.inputTitle
				err := dbstore.UpdateAlertDefinition(&q)
				switch {
				case tc.expectedError != nil:
					require.Error(t, err)

					assert.Equal(t, previousAlertDefinition.Title, q.Result.Title)
					assert.Equal(t, previousAlertDefinition.Condition, q.Result.Condition)
					assert.Equal(t, len(previousAlertDefinition.Data), len(q.Result.Data))
					assert.Equal(t, previousAlertDefinition.IntervalSeconds, q.Result.IntervalSeconds)
					assert.Equal(t, previousAlertDefinition.Updated, q.Result.Updated)
					assert.Equal(t, previousAlertDefinition.Version, q.Result.Version)
					assert.Equal(t, previousAlertDefinition.OrgID, q.Result.OrgID)
					assert.Equal(t, previousAlertDefinition.UID, q.Result.UID)
				default:
					require.NoError(t, err)
					assert.Equal(t, previousAlertDefinition.ID, q.Result.ID)
					assert.Equal(t, previousAlertDefinition.UID, q.Result.UID)
					assert.True(t, q.Result.Updated.After(lastUpdated))
					assert.Equal(t, tc.expectedUpdated, q.Result.Updated)
					assert.Equal(t, previousAlertDefinition.Version+1, q.Result.Version)

					assert.Equal(t, alertDefinition.OrgID, q.Result.OrgID)

					assert.Equal(t, "something completely different", q.Result.Title)
					assert.Equal(t, "B", q.Result.Condition)
					assert.Equal(t, 1, len(q.Result.Data))
					assert.Equal(t, tc.expectedUpdated, q.Result.Updated)
					assert.Equal(t, tc.expectedIntervalSeconds, q.Result.IntervalSeconds)
					assert.Equal(t, previousAlertDefinition.Version+1, q.Result.Version)
					assert.Equal(t, alertDefinition.OrgID, q.Result.OrgID)
					assert.Equal(t, alertDefinition.UID, q.Result.UID)

					previousAlertDefinition = q.Result
				}
			})

		}

	})
}

func TestUpdatingConflictingAlertDefinition(t *testing.T) {
	t.Run("should fail to update alert definition with reserved title", func(t *testing.T) {
		mockTimeNow()
		defer resetTimeNow()

		dbstore := setupTestEnv(t, baseIntervalSeconds)
		t.Cleanup(registry.ClearOverrides)

		var initialInterval int64 = 120
		alertDef1 := createTestAlertDefinition(t, dbstore, initialInterval)
		alertDef2 := createTestAlertDefinition(t, dbstore, initialInterval)

		q := models.UpdateAlertDefinitionCommand{
			UID:       (*alertDef2).UID,
			Title:     alertDef1.Title,
			Condition: "B",
			Data: []models.AlertQuery{
				{
					Model: json.RawMessage(`{
							"datasourceUid": "-100",
							"type":"math",
							"expression":"2 + 3 > 1"
						}`),
					RefID: "B",
					RelativeTimeRange: models.RelativeTimeRange{
						From: models.Duration(5 * time.Hour),
						To:   models.Duration(3 * time.Hour),
					},
				},
			},
		}

		err := dbstore.UpdateAlertDefinition(&q)
		require.Error(t, err)
		assert.True(t, dbstore.SQLStore.Dialect.IsUniqueConstraintViolation(err))
	})
}

func TestDeletingAlertDefinition(t *testing.T) {
	t.Run("zero rows affected when deleting unknown alert", func(t *testing.T) {
		dbstore := setupTestEnv(t, baseIntervalSeconds)
		t.Cleanup(registry.ClearOverrides)

		q := models.DeleteAlertDefinitionByUIDCommand{
			UID:   "unknown",
			OrgID: 1,
		}

		err := dbstore.DeleteAlertDefinitionByUID(&q)
		require.NoError(t, err)
	})

	t.Run("deleting successfully existing alert", func(t *testing.T) {
		dbstore := setupTestEnv(t, baseIntervalSeconds)
		t.Cleanup(registry.ClearOverrides)

		alertDefinition := createTestAlertDefinition(t, dbstore, 60)

		q := models.DeleteAlertDefinitionByUIDCommand{
			UID:   (*alertDefinition).UID,
			OrgID: 1,
		}

		// save an instance for the definition
		saveCmd := &models.SaveAlertInstanceCommand{
			DefinitionOrgID: alertDefinition.OrgID,
			DefinitionUID:   alertDefinition.UID,
			State:           models.InstanceStateFiring,
			Labels:          models.InstanceLabels{"test": "testValue"},
		}
		err := dbstore.SaveAlertInstance(saveCmd)
		require.NoError(t, err)
		listQuery := &models.ListAlertInstancesQuery{
			DefinitionOrgID: alertDefinition.OrgID,
			DefinitionUID:   alertDefinition.UID,
		}
		err = dbstore.ListAlertInstances(listQuery)
		require.NoError(t, err)
		require.Len(t, listQuery.Result, 1)

		err = dbstore.DeleteAlertDefinitionByUID(&q)
		require.NoError(t, err)

		// assert that alert instance is deleted
		err = dbstore.ListAlertInstances(listQuery)
		require.NoError(t, err)

		require.Len(t, listQuery.Result, 0)
	})
}

func getLongString(n int) string {
	b := make([]rune, n)
	for i := range b {
		b[i] = 'a'
	}
	return string(b)
}

// createTestAlertDefinition creates a dummy alert definition to be used by the tests.
func createTestAlertDefinition(t *testing.T, dbstore *store.DBstore, intervalSeconds int64) *models.AlertDefinition {
	cmd := models.SaveAlertDefinitionCommand{
		OrgID:     1,
		Title:     fmt.Sprintf("an alert definition %d", rand.Intn(1000)),
		Condition: "A",
		Data: []models.AlertQuery{
			{
				Model: json.RawMessage(`{
						"datasourceUid": "-100",
						"type":"math",
						"expression":"2 + 2 > 1"
					}`),
				RelativeTimeRange: models.RelativeTimeRange{
					From: models.Duration(5 * time.Hour),
					To:   models.Duration(3 * time.Hour),
				},
				RefID: "A",
			},
		},
		IntervalSeconds: &intervalSeconds,
	}
	err := dbstore.SaveAlertDefinition(&cmd)
	require.NoError(t, err)
	t.Logf("alert definition: %v with interval: %d created", cmd.Result.GetKey(), intervalSeconds)
	return cmd.Result
}
