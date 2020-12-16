// +build integration

package ngalert

import (
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func mockTimeNow() {
	var timeSeed int64
	timeNow = func() time.Time {
		fakeNow := time.Unix(timeSeed, 0)
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

	var customInterval int64 = 120
	testCases := []struct {
		desc                 string
		inputInterval        *int64
		inputName            string
		expectedError        error
		expectedInterval     int64
		expectedUpdatedEpoch int64
	}{
		{
			desc:                 "should create successfuly an alert definition with default interval",
			inputInterval:        nil,
			inputName:            "a name",
			expectedInterval:     defaultIntervalInSeconds,
			expectedUpdatedEpoch: time.Unix(1, 0).Unix(),
		},
		{
			desc:                 "should create successfuly an alert definition with custom interval",
			inputInterval:        &customInterval,
			inputName:            "another name",
			expectedInterval:     customInterval,
			expectedUpdatedEpoch: time.Unix(2, 0).Unix(),
		},
		{
			desc:          "should fail to create an alert definition with too big name",
			inputInterval: &customInterval,
			inputName:     getLongString(alertDefinitionMaxNameLength + 1),
			expectedError: errors.New(""),
		},
	}
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			ng := setupTestEnv(t)
			q := saveAlertDefinitionCommand{
				OrgID: 1,
				Name:  tc.inputName,
				Condition: eval.Condition{
					RefID: "B",
					QueriesAndExpressions: []eval.AlertQuery{
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
				},
			}
			if tc.inputInterval != nil {
				q.IntervalInSeconds = tc.inputInterval
			}
			err := ng.saveAlertDefinition(&q)
			switch {
			case tc.expectedError != nil:
				require.Error(t, err)
			default:
				assert.Equal(t, tc.expectedUpdatedEpoch, q.Result.Updated)
				assert.Equal(t, tc.expectedInterval, q.Result.Interval)
				assert.Equal(t, int64(1), q.Result.Version)

			}
		})
	}
}

func TestUpdatingAlertDefinition(t *testing.T) {
	mockTimeNow()
	defer resetTimeNow()

	t.Run("zero rows affected when updating unknown alert", func(t *testing.T) {
		ng := setupTestEnv(t)

		q := updateAlertDefinitionCommand{
			ID:    1,
			OrgID: 1,
			Name:  "something completely different",
			Condition: eval.Condition{
				RefID: "A",
				QueriesAndExpressions: []eval.AlertQuery{
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
			},
		}

		err := ng.updateAlertDefinition(&q)
		require.NoError(t, err)
		assert.Equal(t, int64(0), q.RowsAffected)
	})

	t.Run("updating existing alert", func(t *testing.T) {
		ng := setupTestEnv(t)
		var initialInterval int64 = 120
		alertDefinition := createTestAlertDefinition(t, ng, initialInterval)
		created := alertDefinition.Updated
		previousVersion := alertDefinition.Version

		var customInterval int64 = 30
		testCases := []struct {
			desc                 string
			inputOrgID           int64
			inputName            string
			inputInterval        *int64
			expectedError        error
			expectedInterval     int64
			expectedUpdatedEpoch int64
		}{
			{
				desc:                 "should not update previous interval if it's not provided",
				inputInterval:        nil,
				inputOrgID:           alertDefinition.OrgID,
				inputName:            "something completely different",
				expectedInterval:     initialInterval,
				expectedUpdatedEpoch: time.Unix(1, 0).Unix(),
			},
			{
				desc:                 "should update interval if it's provided",
				inputInterval:        &customInterval,
				inputOrgID:           alertDefinition.OrgID,
				inputName:            "something completely different",
				expectedInterval:     customInterval,
				expectedUpdatedEpoch: time.Unix(2, 0).Unix(),
			},
			{
				desc:                 "should not update organisation if it's provided",
				inputInterval:        &customInterval,
				inputOrgID:           0,
				inputName:            "something completely different",
				expectedInterval:     customInterval,
				expectedUpdatedEpoch: time.Unix(2, 0).Unix(),
			},
			{
				desc:          "should not update alert definition if the name it's too big",
				inputInterval: &customInterval,
				inputOrgID:    0,
				inputName:     getLongString(alertDefinitionMaxNameLength + 1),
				expectedError: errors.New(""),
			},
		}

		q := updateAlertDefinitionCommand{
			ID:   (*alertDefinition).ID,
			Name: "something completely different",
			Condition: eval.Condition{
				RefID: "B",
				QueriesAndExpressions: []eval.AlertQuery{
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
			},
		}

		lastUpdated := created
		for _, tc := range testCases {
			t.Run(tc.desc, func(t *testing.T) {
				if tc.inputInterval != nil {
					q.IntervalInSeconds = tc.inputInterval
				}
				if tc.inputOrgID != 0 {
					q.OrgID = tc.inputOrgID
				}
				q.Name = tc.inputName
				err := ng.updateAlertDefinition(&q)
				switch {
				case tc.expectedError != nil:
					require.Error(t, err)

					getAlertDefinitionByIDQuery := getAlertDefinitionByIDQuery{ID: (*alertDefinition).ID}
					err = ng.getAlertDefinitionByID(&getAlertDefinitionByIDQuery)
					require.NoError(t, err)
					assert.Equal(t, alertDefinition.Name, getAlertDefinitionByIDQuery.Result.Name)
					assert.Equal(t, alertDefinition.Condition, getAlertDefinitionByIDQuery.Result.Condition)
					assert.Equal(t, len(alertDefinition.Data), len(getAlertDefinitionByIDQuery.Result.Data))
					assert.Equal(t, alertDefinition.Interval, getAlertDefinitionByIDQuery.Result.Interval)
					assert.Equal(t, alertDefinition.Updated, getAlertDefinitionByIDQuery.Result.Updated)
					assert.Equal(t, previousVersion, getAlertDefinitionByIDQuery.Result.Version)
					assert.Equal(t, alertDefinition.OrgID, getAlertDefinitionByIDQuery.Result.OrgID)
				default:
					require.NoError(t, err)
					assert.Equal(t, int64(1), q.RowsAffected)
					assert.Equal(t, int64(1), q.Result.ID)
					assert.Greater(t, q.Result.Updated, lastUpdated)
					updated := q.Result.Updated
					assert.Equal(t, previousVersion+1, q.Result.Version)
					assert.Equal(t, alertDefinition.OrgID, q.Result.OrgID)

					getAlertDefinitionByIDQuery := getAlertDefinitionByIDQuery{ID: (*alertDefinition).ID}
					err = ng.getAlertDefinitionByID(&getAlertDefinitionByIDQuery)
					require.NoError(t, err)
					assert.Equal(t, "something completely different", getAlertDefinitionByIDQuery.Result.Name)
					assert.Equal(t, "B", getAlertDefinitionByIDQuery.Result.Condition)
					assert.Equal(t, 1, len(getAlertDefinitionByIDQuery.Result.Data))
					assert.Greater(t, getAlertDefinitionByIDQuery.Result.Updated, lastUpdated)
					assert.Equal(t, updated, getAlertDefinitionByIDQuery.Result.Updated)
					assert.Equal(t, tc.expectedInterval, getAlertDefinitionByIDQuery.Result.Interval)
					assert.Equal(t, previousVersion+1, getAlertDefinitionByIDQuery.Result.Version)
					assert.Equal(t, alertDefinition.OrgID, getAlertDefinitionByIDQuery.Result.OrgID)

					lastUpdated = updated
					previousVersion = getAlertDefinitionByIDQuery.Result.Version
					alertDefinition = getAlertDefinitionByIDQuery.Result
				}
			})

		}

	})
}

func TestDeletingAlertDefinition(t *testing.T) {
	t.Run("zero rows affected when deleting unknown alert", func(t *testing.T) {
		ng := setupTestEnv(t)

		q := deleteAlertDefinitionByIDCommand{
			ID:    1,
			OrgID: 1,
		}

		err := ng.deleteAlertDefinitionByID(&q)
		require.NoError(t, err)
		assert.Equal(t, int64(0), q.RowsAffected)
	})

	t.Run("deleting successfully existing alert", func(t *testing.T) {
		ng := setupTestEnv(t)
		alertDefinition := createTestAlertDefinition(t, ng, 60)

		q := deleteAlertDefinitionByIDCommand{
			ID:    (*alertDefinition).ID,
			OrgID: 1,
		}

		err := ng.deleteAlertDefinitionByID(&q)
		require.NoError(t, err)
		assert.Equal(t, int64(1), q.RowsAffected)
	})
}

func getLongString(n int) string {
	b := make([]rune, n)
	for i := range b {
		b[i] = 'a'
	}
	return string(b)
}
