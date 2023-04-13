package schedule

import (
	"fmt"
	"math/rand"
	"net/url"
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/go-openapi/strfmt"
	alertingModels "github.com/grafana/alerting/models"
	"github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/util"
)

func Test_stateToPostableAlert(t *testing.T) {
	appURL := &url.URL{
		Scheme: "http:",
		Host:   fmt.Sprintf("host-%d", rand.Int()),
		Path:   fmt.Sprintf("path-%d", rand.Int()),
	}

	testCases := []struct {
		name  string
		state eval.State
	}{
		{
			name:  "when state is Normal",
			state: eval.Normal,
		},
		{
			name:  "when state is Alerting",
			state: eval.Alerting,
		},
		{
			name:  "when state is Pending",
			state: eval.Pending,
		},
		{
			name:  "when state is NoData",
			state: eval.NoData,
		},
		{
			name:  "when state is Error",
			state: eval.Error,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Run("it generates proper URL", func(t *testing.T) {
				t.Run("to alert rule", func(t *testing.T) {
					alertState := randomState(tc.state)
					alertState.Labels[alertingModels.RuleUIDLabel] = alertState.AlertRuleUID
					result := stateToPostableAlert(alertState, appURL)
					u := *appURL
					u.Path = u.Path + "/alerting/grafana/" + alertState.AlertRuleUID + "/view"
					require.Equal(t, u.String(), result.Alert.GeneratorURL.String())
				})

				t.Run("app URL as is if rule UID is not specified", func(t *testing.T) {
					alertState := randomState(tc.state)
					alertState.Labels[alertingModels.RuleUIDLabel] = ""
					result := stateToPostableAlert(alertState, appURL)
					require.Equal(t, appURL.String(), result.Alert.GeneratorURL.String())

					delete(alertState.Labels, alertingModels.RuleUIDLabel)
					result = stateToPostableAlert(alertState, appURL)
					require.Equal(t, appURL.String(), result.Alert.GeneratorURL.String())
				})

				t.Run("empty string if app URL is not provided", func(t *testing.T) {
					alertState := randomState(tc.state)
					alertState.Labels[alertingModels.RuleUIDLabel] = alertState.AlertRuleUID
					result := stateToPostableAlert(alertState, nil)
					require.Equal(t, "", result.Alert.GeneratorURL.String())
				})
			})

			t.Run("Start and End timestamps should be the same", func(t *testing.T) {
				alertState := randomState(tc.state)
				result := stateToPostableAlert(alertState, appURL)
				require.Equal(t, strfmt.DateTime(alertState.StartsAt), result.StartsAt)
				require.Equal(t, strfmt.DateTime(alertState.EndsAt), result.EndsAt)
			})

			t.Run("should copy annotations", func(t *testing.T) {
				alertState := randomState(tc.state)
				alertState.Annotations = randomMapOfStrings()
				result := stateToPostableAlert(alertState, appURL)
				require.Equal(t, models.LabelSet(alertState.Annotations), result.Annotations)

				t.Run("add __value_string__ if it has results", func(t *testing.T) {
					alertState := randomState(tc.state)
					alertState.Annotations = randomMapOfStrings()
					expectedValueString := util.GenerateShortUID()
					alertState.LastEvaluationString = expectedValueString

					result := stateToPostableAlert(alertState, appURL)

					expected := make(models.LabelSet, len(alertState.Annotations)+1)
					for k, v := range alertState.Annotations {
						expected[k] = v
					}
					expected["__value_string__"] = expectedValueString

					require.Equal(t, expected, result.Annotations)

					// even overwrites
					alertState.Annotations["__value_string__"] = util.GenerateShortUID()
					result = stateToPostableAlert(alertState, appURL)
					require.Equal(t, expected, result.Annotations)
				})

				t.Run("add __alertImageToken__ if there is an image url", func(t *testing.T) {
					alertState := randomState(tc.state)
					alertState.Annotations = randomMapOfStrings()
					alertState.ImageURL = "http://localhost:3000/test-url"

					result := stateToPostableAlert(alertState, appURL)

					expected := make(models.LabelSet, len(alertState.Annotations)+1)
					for k, v := range alertState.Annotations {
						expected[k] = v
					}
					expected["__alertImageToken__"] = alertState.ImageURL

					require.Equal(t, expected, result.Annotations)
				})
			})

			t.Run("should add state reason annotation if not empty", func(t *testing.T) {
				alertState := randomState(tc.state)
				alertState.StateReason = "TEST_STATE_REASON"
				result := stateToPostableAlert(alertState, appURL)
				require.Equal(t, alertState.StateReason, result.Annotations[ngModels.StateReasonAnnotation])
			})

			switch tc.state {
			case eval.NoData:
				t.Run("should keep existing labels and change name", func(t *testing.T) {
					alertState := randomState(tc.state)
					alertState.Labels = randomMapOfStrings()
					alertName := util.GenerateShortUID()
					alertState.Labels[model.AlertNameLabel] = alertName

					result := stateToPostableAlert(alertState, appURL)

					expected := make(models.LabelSet, len(alertState.Labels)+1)
					for k, v := range alertState.Labels {
						expected[k] = v
					}
					expected[model.AlertNameLabel] = NoDataAlertName
					expected[Rulename] = alertName

					require.Equal(t, expected, result.Labels)

					t.Run("should not backup original alert name if it does not exist", func(t *testing.T) {
						alertState := randomState(tc.state)
						alertState.Labels = randomMapOfStrings()
						delete(alertState.Labels, model.AlertNameLabel)

						result := stateToPostableAlert(alertState, appURL)

						require.Equal(t, NoDataAlertName, result.Labels[model.AlertNameLabel])
						require.NotContains(t, result.Labels[model.AlertNameLabel], Rulename)
					})
				})
			case eval.Error:
				t.Run("should keep existing labels and change name", func(t *testing.T) {
					alertState := randomState(tc.state)
					alertState.Labels = randomMapOfStrings()
					alertName := util.GenerateShortUID()
					alertState.Labels[model.AlertNameLabel] = alertName

					result := stateToPostableAlert(alertState, appURL)

					expected := make(models.LabelSet, len(alertState.Labels)+1)
					for k, v := range alertState.Labels {
						expected[k] = v
					}
					expected[model.AlertNameLabel] = ErrorAlertName
					expected[Rulename] = alertName

					require.Equal(t, expected, result.Labels)

					t.Run("should not backup original alert name if it does not exist", func(t *testing.T) {
						alertState := randomState(tc.state)
						alertState.Labels = randomMapOfStrings()
						delete(alertState.Labels, model.AlertNameLabel)

						result := stateToPostableAlert(alertState, appURL)

						require.Equal(t, ErrorAlertName, result.Labels[model.AlertNameLabel])
						require.NotContains(t, result.Labels[model.AlertNameLabel], Rulename)
					})
				})
			default:
				t.Run("should copy labels as is", func(t *testing.T) {
					alertState := randomState(tc.state)
					alertState.Labels = randomMapOfStrings()
					result := stateToPostableAlert(alertState, appURL)
					require.Equal(t, models.LabelSet(alertState.Labels), result.Labels)
				})
			}
		})
	}
}

func Test_FromAlertsStateToStoppedAlert(t *testing.T) {
	appURL := &url.URL{
		Scheme: "http:",
		Host:   fmt.Sprintf("host-%d", rand.Int()),
		Path:   fmt.Sprintf("path-%d", rand.Int()),
	}

	evalStates := [...]eval.State{eval.Normal, eval.Alerting, eval.Pending, eval.Error, eval.NoData}
	states := make([]state.StateTransition, 0, len(evalStates)*len(evalStates))
	for _, to := range evalStates {
		for _, from := range evalStates {
			states = append(states, state.StateTransition{
				State:         randomState(to),
				PreviousState: from,
			})
		}
	}

	clk := clock.NewMock()
	clk.Set(time.Now())

	expected := make([]models.PostableAlert, 0, len(states))
	for _, s := range states {
		if !(s.PreviousState == eval.Alerting || s.PreviousState == eval.Error || s.PreviousState == eval.NoData) {
			continue
		}
		alert := stateToPostableAlert(s.State, appURL)
		alert.EndsAt = strfmt.DateTime(clk.Now())
		expected = append(expected, *alert)
	}

	result := FromAlertsStateToStoppedAlert(states, appURL, clk)

	require.Equal(t, expected, result.PostableAlerts)
}

func randomMapOfStrings() map[string]string {
	max := 5
	result := make(map[string]string, max)
	for i := 0; i < max; i++ {
		result[util.GenerateShortUID()] = util.GenerateShortUID()
	}
	return result
}

func randomDuration() time.Duration {
	return time.Duration(rand.Int63n(599)+1) * time.Second
}

func randomTimeInFuture() time.Time {
	return time.Now().Add(randomDuration())
}

func randomTimeInPast() time.Time {
	return time.Now().Add(-randomDuration())
}

func randomState(evalState eval.State) *state.State {
	return &state.State{
		State:              evalState,
		AlertRuleUID:       util.GenerateShortUID(),
		StartsAt:           time.Now(),
		EndsAt:             randomTimeInFuture(),
		LastEvaluationTime: randomTimeInPast(),
		EvaluationDuration: randomDuration(),
		LastSentAt:         randomTimeInPast(),
		Annotations:        make(map[string]string),
		Labels:             make(map[string]string),
		Values:             make(map[string]float64),
	}
}
