package state

import (
	"fmt"
	"math/rand"
	"net/url"
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/go-openapi/strfmt"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	alertingModels "github.com/grafana/alerting/models"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
)

func Test_StateToPostableAlert(t *testing.T) {
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
					alertState := randomTransition(eval.Normal, tc.state)
					alertState.Labels[alertingModels.RuleUIDLabel] = alertState.AlertRuleUID
					result := StateToPostableAlert(alertState, appURL, featuremgmt.WithFeatures())
					u := *appURL
					u.Path = u.Path + "/alerting/grafana/" + alertState.AlertRuleUID + "/view"
					require.Equal(t, u.String(), result.GeneratorURL.String())
				})

				t.Run("app URL as is if rule UID is not specified", func(t *testing.T) {
					alertState := randomTransition(eval.Normal, tc.state)
					alertState.Labels[alertingModels.RuleUIDLabel] = ""
					result := StateToPostableAlert(alertState, appURL, featuremgmt.WithFeatures())
					require.Equal(t, appURL.String(), result.GeneratorURL.String())

					delete(alertState.Labels, alertingModels.RuleUIDLabel)
					result = StateToPostableAlert(alertState, appURL, featuremgmt.WithFeatures())
					require.Equal(t, appURL.String(), result.GeneratorURL.String())
				})

				t.Run("empty string if app URL is not provided", func(t *testing.T) {
					alertState := randomTransition(eval.Normal, tc.state)
					alertState.Labels[alertingModels.RuleUIDLabel] = alertState.AlertRuleUID
					result := StateToPostableAlert(alertState, nil, featuremgmt.WithFeatures())
					require.Equal(t, "", result.GeneratorURL.String())
				})
			})

			t.Run("Start and End timestamps should be the same", func(t *testing.T) {
				alertState := randomTransition(eval.Normal, tc.state)
				result := StateToPostableAlert(alertState, appURL, featuremgmt.WithFeatures())
				require.Equal(t, strfmt.DateTime(alertState.StartsAt), result.StartsAt)
				require.Equal(t, strfmt.DateTime(alertState.EndsAt), result.EndsAt)
			})

			t.Run("StartsAt should be FiredAt if the feature flag is enabled", func(t *testing.T) {
				if tc.state == eval.NoData || tc.state == eval.Error {
					t.Skip("NoData and Error states are not supported for this test")
				}

				alertState := randomTransition(eval.Normal, tc.state)

				// feature flag is disabled
				result := StateToPostableAlert(alertState, appURL, featuremgmt.WithFeatures())
				require.Equal(t, strfmt.DateTime(alertState.StartsAt), result.StartsAt)

				// feature flag is enabled
				result = StateToPostableAlert(alertState, appURL, featuremgmt.WithFeatures(featuremgmt.FlagAlertRuleUseFiredAtForStartsAt))
				require.Equal(t, strfmt.DateTime(*alertState.FiredAt), result.StartsAt)
			})

			t.Run("should copy annotations", func(t *testing.T) {
				alertState := randomTransition(eval.Normal, tc.state)
				alertState.Annotations = randomMapOfStrings()
				result := StateToPostableAlert(alertState, appURL, featuremgmt.WithFeatures())
				require.Equal(t, models.LabelSet(alertState.Annotations), result.Annotations)

				t.Run("add __value_string__ if it has results", func(t *testing.T) {
					alertState := randomTransition(eval.Normal, tc.state)
					alertState.Annotations = randomMapOfStrings()
					expectedValueString := util.GenerateShortUID()
					alertState.LastEvaluationString = expectedValueString

					result := StateToPostableAlert(alertState, appURL, featuremgmt.WithFeatures())

					expected := make(models.LabelSet, len(alertState.Annotations)+1)
					for k, v := range alertState.Annotations {
						expected[k] = v
					}
					expected["__value_string__"] = expectedValueString

					require.Equal(t, expected, result.Annotations)

					// even overwrites
					alertState.Annotations["__value_string__"] = util.GenerateShortUID()
					result = StateToPostableAlert(alertState, appURL, featuremgmt.WithFeatures())
					require.Equal(t, expected, result.Annotations)
				})

				t.Run("add both annotations if there is an image token and url", func(t *testing.T) {
					alertState := randomTransition(eval.Normal, tc.state)
					alertState.Annotations = randomMapOfStrings()
					alertState.Image = &ngModels.Image{Token: "test_token", URL: "test_url"}

					result := StateToPostableAlert(alertState, appURL, featuremgmt.WithFeatures())

					expected := make(models.LabelSet, len(alertState.Annotations)+1)
					for k, v := range alertState.Annotations {
						expected[k] = v
					}
					expected[alertingModels.ImageTokenAnnotation] = alertState.Image.Token
					expected[alertingModels.ImageURLAnnotation] = alertState.Image.URL

					// Sanity check that the annotation is correct.
					require.Contains(t, result.Annotations[alertingModels.ImageTokenAnnotation], alertState.Image.Token)
					require.Contains(t, result.Annotations[alertingModels.ImageURLAnnotation], alertState.Image.URL)

					require.Equal(t, expected, result.Annotations)
				})

				t.Run("don't add annotations if there's no image token or url", func(t *testing.T) {
					alertState := randomTransition(eval.Normal, tc.state)
					alertState.Annotations = randomMapOfStrings()
					alertState.Image = &ngModels.Image{}

					result := StateToPostableAlert(alertState, appURL, featuremgmt.WithFeatures())

					expected := make(models.LabelSet, len(alertState.Annotations)+1)
					for k, v := range alertState.Annotations {
						expected[k] = v
					}

					require.Equal(t, expected, result.Annotations)
				})
			})

			t.Run("should add state reason annotation if not empty", func(t *testing.T) {
				alertState := randomTransition(eval.Normal, tc.state)
				alertState.StateReason = "TEST_STATE_REASON"
				result := StateToPostableAlert(alertState, appURL, featuremgmt.WithFeatures())
				require.Equal(t, alertState.StateReason, result.Annotations[ngModels.StateReasonAnnotation])
			})

			switch tc.state {
			case eval.NoData:
				t.Run("should keep existing labels and change name", func(t *testing.T) {
					alertState := randomTransition(eval.Normal, tc.state)
					alertState.Labels = randomMapOfStrings()
					alertName := util.GenerateShortUID()
					alertState.Labels[model.AlertNameLabel] = alertName

					result := StateToPostableAlert(alertState, appURL, featuremgmt.WithFeatures())

					expected := make(models.LabelSet, len(alertState.Labels)+1)
					for k, v := range alertState.Labels {
						expected[k] = v
					}
					expected[model.AlertNameLabel] = NoDataAlertName
					expected[Rulename] = alertName

					require.Equal(t, expected, result.Labels)

					t.Run("should not backup original alert name if it does not exist", func(t *testing.T) {
						alertState := randomTransition(eval.Normal, tc.state)
						alertState.Labels = randomMapOfStrings()
						delete(alertState.Labels, model.AlertNameLabel)

						result := StateToPostableAlert(alertState, appURL, featuremgmt.WithFeatures())

						require.Equal(t, NoDataAlertName, result.Labels[model.AlertNameLabel])
						require.NotContains(t, result.Labels[model.AlertNameLabel], Rulename)
					})
				})
			case eval.Error:
				t.Run("should keep existing labels and change name", func(t *testing.T) {
					alertState := randomTransition(eval.Normal, tc.state)
					alertState.Labels = randomMapOfStrings()
					alertName := util.GenerateShortUID()
					alertState.Labels[model.AlertNameLabel] = alertName

					result := StateToPostableAlert(alertState, appURL, featuremgmt.WithFeatures())

					expected := make(models.LabelSet, len(alertState.Labels)+1)
					for k, v := range alertState.Labels {
						expected[k] = v
					}
					expected[model.AlertNameLabel] = ErrorAlertName
					expected[Rulename] = alertName

					require.Equal(t, expected, result.Labels)

					t.Run("should not backup original alert name if it does not exist", func(t *testing.T) {
						alertState := randomTransition(eval.Normal, tc.state)
						alertState.Labels = randomMapOfStrings()
						delete(alertState.Labels, model.AlertNameLabel)

						result := StateToPostableAlert(alertState, appURL, featuremgmt.WithFeatures())

						require.Equal(t, ErrorAlertName, result.Labels[model.AlertNameLabel])
						require.NotContains(t, result.Labels[model.AlertNameLabel], Rulename)
					})
				})
			default:
				t.Run("should copy labels as is", func(t *testing.T) {
					alertState := randomTransition(eval.Normal, tc.state)
					alertState.Labels = randomMapOfStrings()
					result := StateToPostableAlert(alertState, appURL, featuremgmt.WithFeatures())
					require.Equal(t, models.LabelSet(alertState.Labels), result.Labels)
				})
			}
		})
	}
}

func TestStateToPostableAlertFromNodataError(t *testing.T) {
	appURL := &url.URL{
		Scheme: "http:",
		Host:   fmt.Sprintf("host-%d", rand.Int()),
		Path:   fmt.Sprintf("path-%d", rand.Int()),
	}

	standardLabels := models.LabelSet{model.AlertNameLabel: "name"}
	noDataLabels := models.LabelSet{Rulename: "name", model.AlertNameLabel: NoDataAlertName}
	errorLabels := models.LabelSet{Rulename: "name", model.AlertNameLabel: ErrorAlertName}

	testCases := []struct {
		name           string
		resolved       bool
		from           eval.State
		to             eval.State
		expectedLabels models.LabelSet
	}{
		// These are the important cases.
		{name: "from NoData to Normal resolved", resolved: true, from: eval.NoData, to: eval.Normal, expectedLabels: noDataLabels},
		{name: "from Error  to Normal resolved", resolved: true, from: eval.Error, to: eval.Normal, expectedLabels: errorLabels},

		// Regressions.
		{name: "from NoData to Normal unresolved", resolved: false, from: eval.NoData, to: eval.Normal, expectedLabels: standardLabels},
		{name: "from Error  to Normal unresolved", resolved: false, from: eval.Error, to: eval.Normal, expectedLabels: standardLabels},
		{name: "from NoData to Alerting unresolved", resolved: false, from: eval.NoData, to: eval.Alerting, expectedLabels: standardLabels},
		{name: "from Error  to Alerting unresolved", resolved: false, from: eval.Error, to: eval.Alerting, expectedLabels: standardLabels},
		{name: "from NoData to Pending unresolved", resolved: false, from: eval.NoData, to: eval.Pending, expectedLabels: standardLabels},
		{name: "from Error  to Pending unresolved", resolved: false, from: eval.Error, to: eval.Pending, expectedLabels: standardLabels},
		{name: "from NoData to NoData unresolved", resolved: false, from: eval.NoData, to: eval.NoData, expectedLabels: noDataLabels},
		{name: "from Error  to NoData unresolved", resolved: false, from: eval.Error, to: eval.NoData, expectedLabels: noDataLabels},
		{name: "from NoData to Error unresolved", resolved: false, from: eval.NoData, to: eval.Error, expectedLabels: errorLabels},
		{name: "from Error  to Error unresolved", resolved: false, from: eval.Error, to: eval.Error, expectedLabels: errorLabels},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			alertState := randomTransition(tc.from, tc.to)
			if tc.resolved {
				alertState.ResolvedAt = &alertState.LastEvaluationTime
			}
			alertState.Labels = data.Labels(standardLabels)
			result := StateToPostableAlert(alertState, appURL, featuremgmt.WithFeatures())
			require.Equal(t, tc.expectedLabels, result.Labels)
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
	states := make([]StateTransition, 0, len(evalStates)*len(evalStates))
	for _, to := range evalStates {
		for _, from := range evalStates {
			states = append(states, randomTransition(from, to))
		}
	}

	clk := clock.NewMock()
	clk.Set(time.Now())

	expected := make([]models.PostableAlert, 0, len(states))
	for _, s := range states {
		if s.PreviousState != eval.Alerting && s.PreviousState != eval.Error && s.PreviousState != eval.NoData {
			continue
		}
		alert := StateToPostableAlert(s, appURL, featuremgmt.WithFeatures())
		alert.EndsAt = strfmt.DateTime(clk.Now())
		expected = append(expected, *alert)
	}

	result := FromAlertsStateToStoppedAlert(states, appURL, clk, featuremgmt.WithFeatures())

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

func randomTransition(from, to eval.State) StateTransition {
	return StateTransition{
		PreviousState: from,
		State: &State{
			State:              to,
			AlertRuleUID:       util.GenerateShortUID(),
			StartsAt:           time.Now(),
			FiredAt:            util.Pointer(randomTimeInPast()),
			EndsAt:             randomTimeInFuture(),
			LastEvaluationTime: randomTimeInPast(),
			EvaluationDuration: randomDuration(),
			LastSentAt:         util.Pointer(randomTimeInPast()),
			Annotations:        make(map[string]string),
			Labels:             make(map[string]string),
			Values:             make(map[string]float64),
		},
	}
}
