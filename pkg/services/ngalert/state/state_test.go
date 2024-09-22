package state

import (
	"context"
	"errors"
	"math"
	"math/rand"
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/golang/mock/gomock"
	"github.com/google/uuid"
	"github.com/grafana/alerting/models"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/screenshot"
	"github.com/grafana/grafana/pkg/util"
)

func TestSetAlerting(t *testing.T) {
	mock := clock.NewMock()
	tests := []struct {
		name     string
		state    State
		reason   string
		startsAt time.Time
		endsAt   time.Time
		expected State
	}{{
		name:     "state is set to Alerting",
		reason:   "this is a reason",
		startsAt: mock.Now(),
		endsAt:   mock.Now().Add(time.Minute),
		expected: State{
			State:       eval.Alerting,
			StateReason: "this is a reason",
			StartsAt:    mock.Now(),
			EndsAt:      mock.Now().Add(time.Minute),
		},
	}, {
		name: "previous state is removed",
		state: State{
			State:       eval.Normal,
			StateReason: "this is a reason",
			Error:       errors.New("this is an error"),
		},
		startsAt: mock.Now(),
		endsAt:   mock.Now().Add(time.Minute),
		expected: State{
			State:    eval.Alerting,
			StartsAt: mock.Now(),
			EndsAt:   mock.Now().Add(time.Minute),
		},
	}}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			actual := test.state
			actual.SetAlerting(test.reason, test.startsAt, test.endsAt)
			assert.Equal(t, test.expected, actual)
		})
	}
}

func TestSetPending(t *testing.T) {
	mock := clock.NewMock()
	tests := []struct {
		name     string
		state    State
		reason   string
		startsAt time.Time
		endsAt   time.Time
		expected State
	}{{
		name:     "state is set to Pending",
		reason:   "this is a reason",
		startsAt: mock.Now(),
		endsAt:   mock.Now().Add(time.Minute),
		expected: State{
			State:       eval.Pending,
			StateReason: "this is a reason",
			StartsAt:    mock.Now(),
			EndsAt:      mock.Now().Add(time.Minute),
		},
	}, {
		name: "previous state is removed",
		state: State{
			State:       eval.Pending,
			StateReason: "this is a reason",
			Error:       errors.New("this is an error"),
		},
		startsAt: mock.Now(),
		endsAt:   mock.Now().Add(time.Minute),
		expected: State{
			State:    eval.Pending,
			StartsAt: mock.Now(),
			EndsAt:   mock.Now().Add(time.Minute),
		},
	}}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			actual := test.state
			actual.SetPending(test.reason, test.startsAt, test.endsAt)
			assert.Equal(t, test.expected, actual)
		})
	}
}

func TestNormal(t *testing.T) {
	mock := clock.NewMock()
	tests := []struct {
		name     string
		state    State
		reason   string
		startsAt time.Time
		endsAt   time.Time
		expected State
	}{{
		name:     "state is set to Normal",
		reason:   "this is a reason",
		startsAt: mock.Now(),
		endsAt:   mock.Now().Add(time.Minute),
		expected: State{
			State:       eval.Normal,
			StateReason: "this is a reason",
			StartsAt:    mock.Now(),
			EndsAt:      mock.Now().Add(time.Minute),
		},
	}, {
		name: "previous state is removed",
		state: State{
			State:       eval.Normal,
			StateReason: "this is a reason",
			Error:       errors.New("this is an error"),
		},
		startsAt: mock.Now(),
		endsAt:   mock.Now().Add(time.Minute),
		expected: State{
			State:    eval.Normal,
			StartsAt: mock.Now(),
			EndsAt:   mock.Now().Add(time.Minute),
		},
	}}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			actual := test.state
			actual.SetNormal(test.reason, test.startsAt, test.endsAt)
			assert.Equal(t, test.expected, actual)
		})
	}
}

func TestNoData(t *testing.T) {
	mock := clock.NewMock()
	tests := []struct {
		name     string
		state    State
		reason   string
		startsAt time.Time
		endsAt   time.Time
		expected State
	}{{
		name:     "state is set to No Data",
		startsAt: mock.Now(),
		endsAt:   mock.Now().Add(time.Minute),
		expected: State{
			State:    eval.NoData,
			StartsAt: mock.Now(),
			EndsAt:   mock.Now().Add(time.Minute),
		},
	}, {
		name: "previous state is removed",
		state: State{
			State:       eval.NoData,
			StateReason: "this is a reason",
			Error:       errors.New("this is an error"),
		},
		startsAt: mock.Now(),
		endsAt:   mock.Now().Add(time.Minute),
		expected: State{
			State:    eval.NoData,
			StartsAt: mock.Now(),
			EndsAt:   mock.Now().Add(time.Minute),
		},
	}}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			actual := test.state
			actual.SetNoData(test.reason, test.startsAt, test.endsAt)
			assert.Equal(t, test.expected, actual)
		})
	}
}

func TestSetError(t *testing.T) {
	mock := clock.NewMock()
	tests := []struct {
		name     string
		state    State
		startsAt time.Time
		endsAt   time.Time
		error    error
		expected State
	}{{
		name:     "state is set to Error",
		startsAt: mock.Now(),
		endsAt:   mock.Now().Add(time.Minute),
		error:    errors.New("this is an error"),
		expected: State{
			State:       eval.Error,
			StateReason: ngmodels.StateReasonError,
			Error:       errors.New("this is an error"),
			StartsAt:    mock.Now(),
			EndsAt:      mock.Now().Add(time.Minute),
		},
	}, {
		name: "previous state is removed",
		state: State{
			State:       eval.Error,
			StateReason: "this is a reason",
			Error:       errors.New("this is an error"),
		},
		startsAt: mock.Now(),
		endsAt:   mock.Now().Add(time.Minute),
		error:    errors.New("this is another error"),
		expected: State{
			State:       eval.Error,
			StateReason: ngmodels.StateReasonError,
			Error:       errors.New("this is another error"),
			StartsAt:    mock.Now(),
			EndsAt:      mock.Now().Add(time.Minute),
		},
	}}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			actual := test.state
			actual.SetError(test.error, test.startsAt, test.endsAt)
			assert.Equal(t, test.expected, actual)
		})
	}
}

func TestMaintain(t *testing.T) {
	mock := clock.NewMock()
	now := mock.Now()

	// the interval is less than the resend interval of 30 seconds
	s := State{State: eval.Alerting, StartsAt: now, EndsAt: now.Add(time.Second)}
	s.Maintain(10, now.Add(10*time.Second))
	// 10 seconds + 4 x 30 seconds is 130 seconds
	assert.Equal(t, now.Add(130*time.Second), s.EndsAt)

	// the interval is above the resend interval of 30 seconds
	s = State{State: eval.Alerting, StartsAt: now, EndsAt: now.Add(time.Second)}
	s.Maintain(60, now.Add(10*time.Second))
	// 10 seconds + 4 x 60 seconds is 250 seconds
	assert.Equal(t, now.Add(250*time.Second), s.EndsAt)
}

func TestEnd(t *testing.T) {
	evaluationTime, _ := time.Parse("2006-01-02", "2021-03-25")
	testCases := []struct {
		name       string
		expected   time.Time
		testRule   *ngmodels.AlertRule
		testResult eval.Result
	}{
		{
			name:     "less than resend delay: for=unset,interval=10s - endsAt = resendDelay * 3",
			expected: evaluationTime.Add(ResendDelay * 4),
			testRule: &ngmodels.AlertRule{
				IntervalSeconds: 10,
			},
		},
		{
			name:     "less than resend delay: for=0s,interval=10s - endsAt = resendDelay * 3",
			expected: evaluationTime.Add(ResendDelay * 4),
			testRule: &ngmodels.AlertRule{
				For:             0 * time.Second,
				IntervalSeconds: 10,
			},
		},
		{
			name:     "less than resend delay: for=10s,interval=10s - endsAt = resendDelay * 3",
			expected: evaluationTime.Add(ResendDelay * 4),
			testRule: &ngmodels.AlertRule{
				For:             10 * time.Second,
				IntervalSeconds: 10,
			},
		},
		{
			name:     "less than resend delay: for=10s,interval=20s - endsAt = resendDelay * 3",
			expected: evaluationTime.Add(ResendDelay * 4),
			testRule: &ngmodels.AlertRule{
				For:             10 * time.Second,
				IntervalSeconds: 20,
			},
		},
		{
			name:     "more than resend delay: for=unset,interval=1m - endsAt = interval * 3",
			expected: evaluationTime.Add(time.Second * 60 * 4),
			testRule: &ngmodels.AlertRule{
				IntervalSeconds: 60,
			},
		},
		{
			name:     "more than resend delay: for=0s,interval=1m - endsAt = resendDelay * 3",
			expected: evaluationTime.Add(time.Second * 60 * 4),
			testRule: &ngmodels.AlertRule{
				For:             0 * time.Second,
				IntervalSeconds: 60,
			},
		},
		{
			name:     "more than resend delay: for=1m,interval=5m - endsAt = interval * 3",
			expected: evaluationTime.Add(time.Second * 300 * 4),
			testRule: &ngmodels.AlertRule{
				For:             time.Minute,
				IntervalSeconds: 300,
			},
		},
		{
			name:     "more than resend delay: for=5m,interval=1m - endsAt = interval * 3",
			expected: evaluationTime.Add(time.Second * 60 * 4),
			testRule: &ngmodels.AlertRule{
				For:             300 * time.Second,
				IntervalSeconds: 60,
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			r := eval.Result{EvaluatedAt: evaluationTime}
			assert.Equal(t, tc.expected, nextEndsTime(tc.testRule.IntervalSeconds, r.EvaluatedAt))
		})
	}
}

func TestNeedsSending(t *testing.T) {
	evaluationTime, _ := time.Parse("2006-01-02", "2021-03-25")
	testCases := []struct {
		name        string
		resendDelay time.Duration
		expected    bool
		testState   *State
	}{
		{
			name:        "state: alerting and LastSentAt before LastEvaluationTime + ResendDelay",
			resendDelay: 1 * time.Minute,
			expected:    true,
			testState: &State{
				State:              eval.Alerting,
				LastEvaluationTime: evaluationTime,
				LastSentAt:         evaluationTime.Add(-2 * time.Minute),
			},
		},
		{
			name:        "state: alerting and LastSentAt after LastEvaluationTime + ResendDelay",
			resendDelay: 1 * time.Minute,
			expected:    false,
			testState: &State{
				State:              eval.Alerting,
				LastEvaluationTime: evaluationTime,
				LastSentAt:         evaluationTime,
			},
		},
		{
			name:        "state: alerting and LastSentAt equals LastEvaluationTime + ResendDelay",
			resendDelay: 1 * time.Minute,
			expected:    true,
			testState: &State{
				State:              eval.Alerting,
				LastEvaluationTime: evaluationTime,
				LastSentAt:         evaluationTime.Add(-1 * time.Minute),
			},
		},
		{
			name:        "state: pending",
			resendDelay: 1 * time.Minute,
			expected:    false,
			testState: &State{
				State: eval.Pending,
			},
		},
		{
			name:        "state: alerting and ResendDelay is zero",
			resendDelay: 0 * time.Minute,
			expected:    true,
			testState: &State{
				State:              eval.Alerting,
				LastEvaluationTime: evaluationTime,
				LastSentAt:         evaluationTime,
			},
		},
		{
			name:        "state: normal + resolved should send without waiting",
			resendDelay: 1 * time.Minute,
			expected:    true,
			testState: &State{
				State:              eval.Normal,
				Resolved:           true,
				LastEvaluationTime: evaluationTime,
				LastSentAt:         evaluationTime,
			},
		},
		{
			name:        "state: normal but not resolved does not send after a minute",
			resendDelay: 1 * time.Minute,
			expected:    false,
			testState: &State{
				State:              eval.Normal,
				Resolved:           false,
				LastEvaluationTime: evaluationTime,
				LastSentAt:         evaluationTime.Add(-1 * time.Minute),
			},
		},
		{
			// LOGZ.IO GRAFANA CHANGE :: DEV-46410 - Do not send a notification on error or no data state
			name:     "state: no-data, should not be re-sent with evaluation time ",
			expected: false,
			// LOGZ.IO GRAFANA CHANGE :: End
			resendDelay: 1 * time.Minute,
			testState: &State{
				State:              eval.NoData,
				LastEvaluationTime: evaluationTime,
				LastSentAt:         evaluationTime.Add(-1 * time.Minute),
			},
		},
		{
			name:        "state: no-data, should not be re-sent",
			expected:    false,
			resendDelay: 1 * time.Minute,
			testState: &State{
				State:              eval.NoData,
				LastEvaluationTime: evaluationTime,
				LastSentAt:         evaluationTime.Add(-time.Duration(rand.Int63n(59)+1) * time.Second),
			},
		},
		{
			// LOGZ.IO GRAFANA CHANGE :: DEV-46410 - Do not send a notification on error or no data state
			name:     "state: error, should not be re-sent with evaluation time",
			expected: false,
			// LOGZ.IO GRAFANA CHANGE :: End
			resendDelay: 1 * time.Minute,
			testState: &State{
				State:              eval.Error,
				LastEvaluationTime: evaluationTime,
				LastSentAt:         evaluationTime.Add(-1 * time.Minute),
			},
		},
		{
			name:        "state: error, should not be re-sent",
			expected:    false,
			resendDelay: 1 * time.Minute,
			testState: &State{
				State:              eval.Error,
				LastEvaluationTime: evaluationTime,
				LastSentAt:         evaluationTime.Add(-time.Duration(rand.Int63n(59)+1) * time.Second),
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, tc.testState.NeedsSending(tc.resendDelay))
		})
	}
}

func TestGetLastEvaluationValuesForCondition(t *testing.T) {
	genState := func(results []Evaluation) *State {
		return &State{
			Results: results,
		}
	}

	t.Run("should return nil if no results", func(t *testing.T) {
		result := genState(nil).GetLastEvaluationValuesForCondition()
		require.Nil(t, result)
	})
	t.Run("should return value of the condition of the last result", func(t *testing.T) {
		expected := rand.Float64()
		evals := []Evaluation{
			{
				EvaluationTime:  time.Time{},
				EvaluationState: 0,
				Values: map[string]*float64{
					"A": util.Pointer(rand.Float64()),
				},
				Condition: "A",
			},
			{
				EvaluationTime:  time.Time{},
				EvaluationState: 0,
				Values: map[string]*float64{
					"B": util.Pointer(rand.Float64()),
					"A": util.Pointer(expected),
				},
				Condition: "A",
			},
		}
		result := genState(evals).GetLastEvaluationValuesForCondition()
		require.Len(t, result, 1)
		require.Contains(t, result, "A")
		require.Equal(t, result["A"], expected)
	})
	t.Run("should return empty map if there is no value for condition", func(t *testing.T) {
		evals := []Evaluation{
			{
				EvaluationTime:  time.Time{},
				EvaluationState: 0,
				Values: map[string]*float64{
					"C": util.Pointer(rand.Float64()),
				},
				Condition: "A",
			},
		}
		result := genState(evals).GetLastEvaluationValuesForCondition()
		require.NotNil(t, result)
		require.Len(t, result, 0)
	})
	t.Run("should use NaN if value is not defined", func(t *testing.T) {
		evals := []Evaluation{
			{
				EvaluationTime:  time.Time{},
				EvaluationState: 0,
				Values: map[string]*float64{
					"A": nil,
				},
				Condition: "A",
			},
		}
		result := genState(evals).GetLastEvaluationValuesForCondition()
		require.NotNil(t, result)
		require.Len(t, result, 1)
		require.Contains(t, result, "A")
		require.Truef(t, math.IsNaN(result["A"]), "expected NaN but got %v", result["A"])
	})
}

func TestResolve(t *testing.T) {
	s := State{State: eval.Alerting, EndsAt: time.Now().Add(time.Minute)}
	expected := State{State: eval.Normal, StateReason: "This is a reason", EndsAt: time.Now(), Resolved: true}
	s.Resolve("This is a reason", expected.EndsAt)
	assert.Equal(t, expected, s)
}

func TestShouldTakeImage(t *testing.T) {
	tests := []struct {
		name          string
		state         eval.State
		previousState eval.State
		previousImage *ngmodels.Image
		resolved      bool
		expected      bool
	}{{
		name:          "should take image for state that just transitioned to alerting",
		state:         eval.Alerting,
		previousState: eval.Pending,
		expected:      true,
	}, {
		name:          "should take image for alerting state without image",
		state:         eval.Alerting,
		previousState: eval.Alerting,
		expected:      true,
	}, {
		name:          "should take image for resolved state",
		state:         eval.Normal,
		previousState: eval.Alerting,
		resolved:      true,
		expected:      true,
	}, {
		name:          "should not take image for normal state",
		state:         eval.Normal,
		previousState: eval.Normal,
	}, {
		name:          "should not take image for pending state",
		state:         eval.Pending,
		previousState: eval.Normal,
	}, {
		name:          "should not take image for alerting state with image",
		state:         eval.Alerting,
		previousState: eval.Alerting,
		previousImage: &ngmodels.Image{URL: "https://example.com/foo.png"},
	}}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.expected, shouldTakeImage(test.state, test.previousState, test.previousImage, test.resolved))
		})
	}
}

func TestTakeImage(t *testing.T) {
	t.Run("ErrNoDashboard should return nil", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		ctx := context.Background()
		r := ngmodels.AlertRule{}
		s := NewMockImageCapturer(ctrl)

		s.EXPECT().NewImage(ctx, &r).Return(nil, ngmodels.ErrNoDashboard)
		image, err := takeImage(ctx, s, &r)
		assert.NoError(t, err)
		assert.Nil(t, image)
	})

	t.Run("ErrNoPanel should return nil", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		ctx := context.Background()
		r := ngmodels.AlertRule{DashboardUID: util.Pointer("foo")}
		s := NewMockImageCapturer(ctrl)

		s.EXPECT().NewImage(ctx, &r).Return(nil, ngmodels.ErrNoPanel)
		image, err := takeImage(ctx, s, &r)
		assert.NoError(t, err)
		assert.Nil(t, image)
	})

	t.Run("ErrScreenshotsUnavailable should return nil", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		ctx := context.Background()
		r := ngmodels.AlertRule{DashboardUID: util.Pointer("foo"), PanelID: util.Pointer(int64(1))}
		s := NewMockImageCapturer(ctrl)

		s.EXPECT().NewImage(ctx, &r).Return(nil, screenshot.ErrScreenshotsUnavailable)
		image, err := takeImage(ctx, s, &r)
		assert.NoError(t, err)
		assert.Nil(t, image)
	})

	t.Run("other errors should be returned", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		ctx := context.Background()
		r := ngmodels.AlertRule{DashboardUID: util.Pointer("foo"), PanelID: util.Pointer(int64(1))}
		s := NewMockImageCapturer(ctrl)

		s.EXPECT().NewImage(ctx, &r).Return(nil, errors.New("unknown error"))
		image, err := takeImage(ctx, s, &r)
		assert.EqualError(t, err, "unknown error")
		assert.Nil(t, image)
	})

	t.Run("image should be returned", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		ctx := context.Background()
		r := ngmodels.AlertRule{DashboardUID: util.Pointer("foo"), PanelID: util.Pointer(int64(1))}
		s := NewMockImageCapturer(ctrl)

		s.EXPECT().NewImage(ctx, &r).Return(&ngmodels.Image{Path: "foo.png"}, nil)
		image, err := takeImage(ctx, s, &r)
		assert.NoError(t, err)
		require.NotNil(t, image)
		assert.Equal(t, ngmodels.Image{Path: "foo.png"}, *image)
	})
}

func TestParseFormattedState(t *testing.T) {
	t.Run("should parse formatted state", func(t *testing.T) {
		stateStr := "Normal (MissingSeries)"
		s, reason, err := ParseFormattedState(stateStr)
		require.NoError(t, err)

		require.Equal(t, eval.Normal, s)
		require.Equal(t, ngmodels.StateReasonMissingSeries, reason)
	})

	t.Run("should parse formatted state with concatenated reasons", func(t *testing.T) {
		stateStr := "Normal (Error, KeepLast)"
		s, reason, err := ParseFormattedState(stateStr)
		require.NoError(t, err)

		require.Equal(t, eval.Normal, s)
		require.Equal(t, ngmodels.ConcatReasons(ngmodels.StateReasonError, ngmodels.StateReasonKeepLast), reason)
	})

	t.Run("should error on empty string", func(t *testing.T) {
		stateStr := ""
		_, _, err := ParseFormattedState(stateStr)
		require.Error(t, err)
	})

	t.Run("should error on invalid string content", func(t *testing.T) {
		stateStr := "NotAState"
		_, _, err := ParseFormattedState(stateStr)
		require.Error(t, err)
	})
}

func TestGetRuleExtraLabels(t *testing.T) {
	logger := log.New()

	rule := ngmodels.AlertRuleGen()()
	rule.NotificationSettings = nil
	folderTitle := uuid.NewString()

	ns := ngmodels.NotificationSettings{
		Receiver:  "Test",
		GroupBy:   []string{"alertname"},
		GroupWait: util.Pointer(model.Duration(1 * time.Second)),
	}

	testCases := map[string]struct {
		rule          *ngmodels.AlertRule
		includeFolder bool
		expected      map[string]string
	}{
		"no_folder_no_notification": {
			rule:          ngmodels.CopyRule(rule),
			includeFolder: false,
			expected: map[string]string{
				models.NamespaceUIDLabel: rule.NamespaceUID,
				model.AlertNameLabel:     rule.Title,
				models.RuleUIDLabel:      rule.UID,
			},
		},
		"with_folder_no_notification": {
			rule:          ngmodels.CopyRule(rule),
			includeFolder: true,
			expected: map[string]string{
				models.NamespaceUIDLabel: rule.NamespaceUID,
				model.AlertNameLabel:     rule.Title,
				models.RuleUIDLabel:      rule.UID,
				models.FolderTitleLabel:  folderTitle,
			},
		},
		"with_notification": {
			rule: func() *ngmodels.AlertRule {
				r := ngmodels.CopyRule(rule)
				r.NotificationSettings = []ngmodels.NotificationSettings{ns}
				return r
			}(),
			expected: map[string]string{
				models.NamespaceUIDLabel:                     rule.NamespaceUID,
				model.AlertNameLabel:                         rule.Title,
				models.RuleUIDLabel:                          rule.UID,
				ngmodels.AutogeneratedRouteLabel:             "true",
				ngmodels.AutogeneratedRouteReceiverNameLabel: ns.Receiver,
				ngmodels.AutogeneratedRouteSettingsHashLabel: ns.Fingerprint().String(),
			},
		},
		"ignore_multiple_notifications": {
			rule: func() *ngmodels.AlertRule {
				r := ngmodels.CopyRule(rule)
				r.NotificationSettings = []ngmodels.NotificationSettings{ns, ngmodels.NotificationSettingsGen()(), ngmodels.NotificationSettingsGen()()}
				return r
			}(),
			expected: map[string]string{
				models.NamespaceUIDLabel:                     rule.NamespaceUID,
				model.AlertNameLabel:                         rule.Title,
				models.RuleUIDLabel:                          rule.UID,
				ngmodels.AutogeneratedRouteLabel:             "true",
				ngmodels.AutogeneratedRouteReceiverNameLabel: ns.Receiver,
				ngmodels.AutogeneratedRouteSettingsHashLabel: ns.Fingerprint().String(),
			},
		},
	}

	for name, tc := range testCases {
		t.Run(name, func(t *testing.T) {
			result := GetRuleExtraLabels(logger, tc.rule, folderTitle, tc.includeFolder)
			require.Equal(t, tc.expected, result)
		})
	}
}
