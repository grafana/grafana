// +build integration

package ngalert

import (
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func mockTimeNow() {
	var timeSeed int64
	timeNow = func() time.Time {
		fakeNow := time.Unix(timeSeed, 0).UTC()
		timeSeed++
		return fakeNow
	}
}

func resetTimeNow() {
	timeNow = time.Now
}

func TestCreatingAlertDefinition(t *testing.T) {
	mockTimeNow()
	defer resetTimeNow()

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
			desc:                 "should create successfuly an alert definition with default interval",
			inputIntervalSeconds: nil,
			inputTitle:           "a name",
			expectedInterval:     defaultIntervalSeconds,
			expectedUpdated:      time.Unix(0, 0).UTC(),
		},
		{
			desc:                 "should create successfuly an alert definition with custom interval",
			inputIntervalSeconds: &customIntervalSeconds,
			inputTitle:           "another name",
			expectedInterval:     customIntervalSeconds,
			expectedUpdated:      time.Unix(1, 0).UTC(),
		},
		{
			desc:                 "should fail to create an alert definition with too big name",
			inputIntervalSeconds: &customIntervalSeconds,
			inputTitle:           getLongString(alertDefinitionMaxTitleLength + 1),
			expectedError:        errors.New(""),
		},
		{
			desc:                 "should fail to create an alert definition with empty title",
			inputIntervalSeconds: &customIntervalSeconds,
			inputTitle:           "",
			expectedError:        errEmptyTitleError,
		},
	}
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			ng := setupTestEnv(t)
			t.Cleanup(registry.ClearOverrides)

			q := saveAlertDefinitionCommand{
				OrgID:     1,
				Title:     tc.inputTitle,
				Condition: "B",
				Data: []eval.AlertQuery{
					{
						Model: json.RawMessage(`{
								"datasource": "__expr__",
								"type":"math",
								"expression":"2 + 3 > 1"
							}`),
						RefID: "B",
						RelativeTimeRange: eval.RelativeTimeRange{
							From: eval.Duration(time.Duration(5) * time.Hour),
							To:   eval.Duration(time.Duration(3) * time.Hour),
						},
					},
				},
			}
			if tc.inputIntervalSeconds != nil {
				q.IntervalSeconds = tc.inputIntervalSeconds
			}
			err := ng.saveAlertDefinition(&q)
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
		ng := setupTestEnv(t)
		t.Cleanup(registry.ClearOverrides)

		q := saveAlertDefinitionCommand{
			OrgID:     1,
			Title:     "title",
			Condition: "B",
			Data: []eval.AlertQuery{
				{
					Model: json.RawMessage(`{
								"datasource": "__expr__",
								"type":"math",
								"expression":"2 + 3 > 1"
							}`),
					RefID: "B",
					RelativeTimeRange: eval.RelativeTimeRange{
						From: eval.Duration(time.Duration(5) * time.Hour),
						To:   eval.Duration(time.Duration(3) * time.Hour),
					},
				},
			},
		}

		err := ng.saveAlertDefinition(&q)
		require.NoError(t, err)

		err = ng.saveAlertDefinition(&q)
		require.Error(t, err)
		assert.True(t, ng.SQLStore.Dialect.IsUniqueConstraintViolation(err))
	})
}

func TestUpdatingAlertDefinition(t *testing.T) {
	t.Run("zero rows affected when updating unknown alert", func(t *testing.T) {
		mockTimeNow()
		defer resetTimeNow()

		ng := setupTestEnv(t)
		t.Cleanup(registry.ClearOverrides)

		q := updateAlertDefinitionCommand{
			UID:       "unknown",
			OrgID:     1,
			Title:     "something completely different",
			Condition: "A",
			Data: []eval.AlertQuery{
				{
					Model: json.RawMessage(`{
							"datasource": "__expr__",
							"type":"math",
							"expression":"2 + 2 > 1"
						}`),
					RefID: "A",
					RelativeTimeRange: eval.RelativeTimeRange{
						From: eval.Duration(time.Duration(5) * time.Hour),
						To:   eval.Duration(time.Duration(3) * time.Hour),
					},
				},
			},
		}

		err := ng.updateAlertDefinition(&q)
		require.NoError(t, err)
	})

	t.Run("updating existing alert", func(t *testing.T) {
		mockTimeNow()
		defer resetTimeNow()

		ng := setupTestEnv(t)
		t.Cleanup(registry.ClearOverrides)

		var initialInterval int64 = 120
		alertDefinition := createTestAlertDefinition(t, ng, initialInterval)
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
				inputTitle:    getLongString(alertDefinitionMaxTitleLength + 1),
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

		q := updateAlertDefinitionCommand{
			UID:       (*alertDefinition).UID,
			Condition: "B",
			Data: []eval.AlertQuery{
				{
					Model: json.RawMessage(`{
							"datasource": "__expr__",
							"type":"math",
							"expression":"2 + 3 > 1"
						}`),
					RefID: "B",
					RelativeTimeRange: eval.RelativeTimeRange{
						From: eval.Duration(5 * time.Hour),
						To:   eval.Duration(3 * time.Hour),
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
				err := ng.updateAlertDefinition(&q)
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

		ng := setupTestEnv(t)
		t.Cleanup(registry.ClearOverrides)

		var initialInterval int64 = 120
		alertDef1 := createTestAlertDefinition(t, ng, initialInterval)
		alertDef2 := createTestAlertDefinition(t, ng, initialInterval)

		q := updateAlertDefinitionCommand{
			UID:       (*alertDef2).UID,
			Title:     alertDef1.Title,
			Condition: "B",
			Data: []eval.AlertQuery{
				{
					Model: json.RawMessage(`{
							"datasource": "__expr__",
							"type":"math",
							"expression":"2 + 3 > 1"
						}`),
					RefID: "B",
					RelativeTimeRange: eval.RelativeTimeRange{
						From: eval.Duration(5 * time.Hour),
						To:   eval.Duration(3 * time.Hour),
					},
				},
			},
		}

		err := ng.updateAlertDefinition(&q)
		require.Error(t, err)
		assert.True(t, ng.SQLStore.Dialect.IsUniqueConstraintViolation(err))
	})
}

func TestDeletingAlertDefinition(t *testing.T) {
	t.Run("zero rows affected when deleting unknown alert", func(t *testing.T) {
		ng := setupTestEnv(t)
		t.Cleanup(registry.ClearOverrides)

		q := deleteAlertDefinitionByUIDCommand{
			UID:   "unknown",
			OrgID: 1,
		}

		err := ng.deleteAlertDefinitionByUID(&q)
		require.NoError(t, err)
	})

	t.Run("deleting successfully existing alert", func(t *testing.T) {
		ng := setupTestEnv(t)
		t.Cleanup(registry.ClearOverrides)

		alertDefinition := createTestAlertDefinition(t, ng, 60)

		q := deleteAlertDefinitionByUIDCommand{
			UID:   (*alertDefinition).UID,
			OrgID: 1,
		}

		// save an instance for the definition
		saveCmd := &saveAlertInstanceCommand{
			DefinitionOrgID: alertDefinition.OrgID,
			DefinitionUID:   alertDefinition.UID,
			State:           InstanceStateFiring,
			Labels:          InstanceLabels{"test": "testValue"},
		}
		err := ng.saveAlertInstance(saveCmd)
		require.NoError(t, err)
		listCommand := &listAlertInstancesQuery{
			DefinitionOrgID: alertDefinition.OrgID,
			DefinitionUID:   alertDefinition.UID,
		}
		err = ng.listAlertInstances(listCommand)
		require.NoError(t, err)
		require.Len(t, listCommand.Result, 1)

		err = ng.deleteAlertDefinitionByUID(&q)
		require.NoError(t, err)

		// assert that alert instance is deleted
		err = ng.listAlertInstances(listCommand)
		require.NoError(t, err)

		require.Len(t, listCommand.Result, 0)
	})
}

func getLongString(n int) string {
	b := make([]rune, n)
	for i := range b {
		b[i] = 'a'
	}
	return string(b)
}
