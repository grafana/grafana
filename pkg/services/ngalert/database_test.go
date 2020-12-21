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
		expectedUpdated      time.Time
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
			inputTitle:           getLongString(alertDefinitionMaxNameLength + 1),
			expectedError:        errors.New(""),
		},
	}
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			ng := setupTestEnv(t)
			q := saveAlertDefinitionCommand{
				OrgID: 1,
				Title: tc.inputTitle,
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

func TestUpdatingAlertDefinition(t *testing.T) {
	mockTimeNow()
	defer resetTimeNow()

	t.Run("zero rows affected when updating unknown alert", func(t *testing.T) {
		ng := setupTestEnv(t)

		q := updateAlertDefinitionCommand{
			ID:    1,
			OrgID: 1,
			Title: "something completely different",
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

		var customInterval int64 = 30
		testCases := []struct {
			desc                    string
			inputOrgID              int64
			inputTitle              string
			inputInterval           *int64
			expectedError           error
			expectedIntervalSeconds int64
			expectedUpdated         time.Time
		}{
			{
				desc:                    "should not update previous interval if it's not provided",
				inputInterval:           nil,
				inputOrgID:              alertDefinition.OrgID,
				inputTitle:              "something completely different",
				expectedIntervalSeconds: initialInterval,
				expectedUpdated:         time.Unix(2, 0).UTC(),
			},
			{
				desc:                    "should update interval if it's provided",
				inputInterval:           &customInterval,
				inputOrgID:              alertDefinition.OrgID,
				inputTitle:              "something completely different",
				expectedIntervalSeconds: customInterval,
				expectedUpdated:         time.Unix(3, 0).UTC(),
			},
			{
				desc:                    "should not update organisation if it's provided",
				inputInterval:           &customInterval,
				inputOrgID:              0,
				inputTitle:              "something completely different",
				expectedIntervalSeconds: customInterval,
				expectedUpdated:         time.Unix(4, 0).UTC(),
			},
			{
				desc:          "should not update alert definition if the name it's too big",
				inputInterval: &customInterval,
				inputOrgID:    0,
				inputTitle:    getLongString(alertDefinitionMaxNameLength + 1),
				expectedError: errors.New(""),
			},
		}

		q := updateAlertDefinitionCommand{
			ID:    (*alertDefinition).ID,
			Title: "something completely different",
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

					getAlertDefinitionByIDQuery := getAlertDefinitionByIDQuery{ID: (*alertDefinition).ID}
					err = ng.getAlertDefinitionByID(&getAlertDefinitionByIDQuery)
					require.NoError(t, err)
					assert.Equal(t, previousAlertDefinition.Title, getAlertDefinitionByIDQuery.Result.Title)
					assert.Equal(t, previousAlertDefinition.Condition, getAlertDefinitionByIDQuery.Result.Condition)
					assert.Equal(t, len(previousAlertDefinition.Data), len(getAlertDefinitionByIDQuery.Result.Data))
					assert.Equal(t, previousAlertDefinition.IntervalSeconds, getAlertDefinitionByIDQuery.Result.IntervalSeconds)
					assert.Equal(t, previousAlertDefinition.Updated, getAlertDefinitionByIDQuery.Result.Updated)
					assert.Equal(t, previousAlertDefinition.Version, getAlertDefinitionByIDQuery.Result.Version)
					assert.Equal(t, previousAlertDefinition.OrgID, getAlertDefinitionByIDQuery.Result.OrgID)
					assert.Equal(t, previousAlertDefinition.UID, getAlertDefinitionByIDQuery.Result.UID)
				default:
					require.NoError(t, err)
					assert.Equal(t, int64(1), q.RowsAffected)
					assert.Equal(t, int64(1), q.Result.ID)
					assert.True(t, q.Result.Updated.After(lastUpdated))
					assert.Equal(t, tc.expectedUpdated, q.Result.Updated)
					assert.Equal(t, previousAlertDefinition.Version+1, q.Result.Version)

					assert.Equal(t, alertDefinition.OrgID, q.Result.OrgID)

					getAlertDefinitionByIDQuery := getAlertDefinitionByIDQuery{ID: (*alertDefinition).ID}
					err = ng.getAlertDefinitionByID(&getAlertDefinitionByIDQuery)
					require.NoError(t, err)
					assert.Equal(t, "something completely different", getAlertDefinitionByIDQuery.Result.Title)
					assert.Equal(t, "B", getAlertDefinitionByIDQuery.Result.Condition)
					assert.Equal(t, 1, len(getAlertDefinitionByIDQuery.Result.Data))
					assert.Equal(t, tc.expectedUpdated, getAlertDefinitionByIDQuery.Result.Updated)
					assert.Equal(t, tc.expectedIntervalSeconds, getAlertDefinitionByIDQuery.Result.IntervalSeconds)
					assert.Equal(t, previousAlertDefinition.Version+1, getAlertDefinitionByIDQuery.Result.Version)
					assert.Equal(t, alertDefinition.OrgID, getAlertDefinitionByIDQuery.Result.OrgID)
					assert.Equal(t, alertDefinition.UID, getAlertDefinitionByIDQuery.Result.UID)

					previousAlertDefinition = getAlertDefinitionByIDQuery.Result
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
