package state

import (
	"context"
	"errors"
	"fmt"
	"math"
	"math/rand"
	"net/url"
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/golang/mock/gomock"
	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/alerting/models"

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
			FiredAt:     mock.Now(),
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
			FiredAt:  mock.Now(),
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
		name              string
		resendDelay       time.Duration
		resolvedRetention time.Duration
		expected          bool
		testState         *State
	}{
		{
			name:        "state: alerting and LastSentAt before LastEvaluationTime + ResendDelay",
			resendDelay: 1 * time.Minute,
			expected:    true,
			testState: &State{
				State:              eval.Alerting,
				LastEvaluationTime: evaluationTime,
				LastSentAt:         util.Pointer(evaluationTime.Add(-2 * time.Minute)),
			},
		},
		{
			name:        "state: alerting and LastSentAt after LastEvaluationTime + ResendDelay",
			resendDelay: 1 * time.Minute,
			expected:    false,
			testState: &State{
				State:              eval.Alerting,
				LastEvaluationTime: evaluationTime,
				LastSentAt:         util.Pointer(evaluationTime),
			},
		},
		{
			name:        "state: alerting and LastSentAt equals LastEvaluationTime + ResendDelay",
			resendDelay: 1 * time.Minute,
			expected:    true,
			testState: &State{
				State:              eval.Alerting,
				LastEvaluationTime: evaluationTime,
				LastSentAt:         util.Pointer(evaluationTime.Add(-1 * time.Minute)),
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
				LastSentAt:         util.Pointer(evaluationTime),
			},
		},
		{
			name:        "state: normal + resolved should send without waiting if ResolvedAt > LastSentAt",
			resendDelay: 1 * time.Minute,
			expected:    true,
			testState: &State{
				State:              eval.Normal,
				ResolvedAt:         util.Pointer(evaluationTime),
				LastEvaluationTime: evaluationTime,
				LastSentAt:         util.Pointer(evaluationTime.Add(-1 * time.Minute)),
			},
		},
		{
			name:              "state: normal + recently resolved should send with wait",
			resendDelay:       1 * time.Minute,
			resolvedRetention: 15 * time.Minute,
			expected:          true,
			testState: &State{
				State:              eval.Normal,
				ResolvedAt:         util.Pointer(evaluationTime.Add(-2 * time.Minute)),
				LastEvaluationTime: evaluationTime,
				LastSentAt:         util.Pointer(evaluationTime.Add(-1 * time.Minute)),
			},
		},
		{
			name:              "state: normal + recently resolved should not send without wait",
			resendDelay:       2 * time.Minute,
			resolvedRetention: 15 * time.Minute,
			expected:          false,
			testState: &State{
				State:              eval.Normal,
				ResolvedAt:         util.Pointer(evaluationTime.Add(-2 * time.Minute)),
				LastEvaluationTime: evaluationTime,
				LastSentAt:         util.Pointer(evaluationTime.Add(-1 * time.Minute)),
			},
		},
		{
			name:              "state: normal + not recently resolved should not send even with wait",
			resendDelay:       1 * time.Minute,
			resolvedRetention: 15 * time.Minute,
			expected:          false,
			testState: &State{
				State:              eval.Normal,
				ResolvedAt:         util.Pointer(evaluationTime.Add(-16 * time.Minute)),
				LastEvaluationTime: evaluationTime,
				LastSentAt:         util.Pointer(evaluationTime.Add(-1 * time.Minute)),
			},
		},
		{
			name:        "state: normal but not resolved does not send after a minute",
			resendDelay: 1 * time.Minute,
			expected:    false,
			testState: &State{
				State:              eval.Normal,
				ResolvedAt:         util.Pointer(time.Time{}),
				LastEvaluationTime: evaluationTime,
				LastSentAt:         util.Pointer(evaluationTime.Add(-1 * time.Minute)),
			},
		},
		{
			name:        "state: no-data, needs to be re-sent",
			expected:    true,
			resendDelay: 1 * time.Minute,
			testState: &State{
				State:              eval.NoData,
				LastEvaluationTime: evaluationTime,
				LastSentAt:         util.Pointer(evaluationTime.Add(-1 * time.Minute)),
			},
		},
		{
			name:        "state: no-data, should not be re-sent",
			expected:    false,
			resendDelay: 1 * time.Minute,
			testState: &State{
				State:              eval.NoData,
				LastEvaluationTime: evaluationTime,
				LastSentAt:         util.Pointer(evaluationTime.Add(-time.Duration(rand.Int63n(59)+1) * time.Second)),
			},
		},
		{
			name:        "state: error, needs to be re-sent",
			expected:    true,
			resendDelay: 1 * time.Minute,
			testState: &State{
				State:              eval.Error,
				LastEvaluationTime: evaluationTime,
				LastSentAt:         util.Pointer(evaluationTime.Add(-1 * time.Minute)),
			},
		},
		{
			name:        "state: error, should not be re-sent",
			expected:    false,
			resendDelay: 1 * time.Minute,
			testState: &State{
				State:              eval.Error,
				LastEvaluationTime: evaluationTime,
				LastSentAt:         util.Pointer(evaluationTime.Add(-time.Duration(rand.Int63n(59)+1) * time.Second)),
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, tc.testState.NeedsSending(tc.resendDelay, tc.resolvedRetention))
		})
	}
}

func TestGetLastEvaluationValuesForCondition(t *testing.T) {
	genState := func(latestResult *Evaluation) *State {
		return &State{
			LatestResult: latestResult,
		}
	}

	t.Run("should return nil if no results", func(t *testing.T) {
		result := genState(nil).GetLastEvaluationValuesForCondition()
		require.Nil(t, result)
	})
	t.Run("should return value of the condition of the last result", func(t *testing.T) {
		expected := rand.Float64()
		eval := &Evaluation{
			EvaluationTime:  time.Time{},
			EvaluationState: 0,
			Values: map[string]float64{
				"B": rand.Float64(),
				"A": expected,
			},
			Condition: "A",
		}
		result := genState(eval).GetLastEvaluationValuesForCondition()
		require.Len(t, result, 1)
		require.Contains(t, result, "A")
		require.Equal(t, result["A"], expected)
	})
	t.Run("should return empty map if there is no value for condition", func(t *testing.T) {
		eval := &Evaluation{
			EvaluationTime:  time.Time{},
			EvaluationState: 0,
			Values: map[string]float64{
				"C": rand.Float64(),
			},
			Condition: "A",
		}
		result := genState(eval).GetLastEvaluationValuesForCondition()
		require.NotNil(t, result)
		require.Len(t, result, 0)
	})
	t.Run("should use NaN if value is not defined", func(t *testing.T) {
		eval := &Evaluation{
			EvaluationTime:  time.Time{},
			EvaluationState: 0,
			Values: map[string]float64{
				"A": math.NaN(),
			},
			Condition: "A",
		}
		result := genState(eval).GetLastEvaluationValuesForCondition()
		require.NotNil(t, result)
		require.Len(t, result, 1)
		require.Contains(t, result, "A")
		require.Truef(t, math.IsNaN(result["A"]), "expected NaN but got %v", result["A"])
	})
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
		name:          "should not take image for alerting state with valid image",
		state:         eval.Alerting,
		previousState: eval.Alerting,
		previousImage: &ngmodels.Image{URL: "https://example.com/foo.png", ExpiresAt: time.Now().Add(time.Hour)},
	}, {
		name:          "should take image for alerting state with expired image",
		state:         eval.Alerting,
		previousState: eval.Alerting,
		previousImage: &ngmodels.Image{URL: "https://example.com/foo.png", ExpiresAt: time.Now().Add(-time.Hour)},
		expected:      true,
	}}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.expected, shouldTakeImage(test.state, test.previousState, test.previousImage, test.resolved) != "")
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

	rule := ngmodels.RuleGen.With(ngmodels.RuleMuts.WithNoNotificationSettings()).GenerateRef()
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

func TestNewState(t *testing.T) {
	url := &url.URL{
		Scheme: "http",
		Host:   "localhost:3000",
		Path:   "/test",
	}
	l := log.New("test")

	gen := ngmodels.RuleGen
	generateRule := gen.With(gen.WithNotEmptyLabels(5, "rule-")).GenerateRef

	t.Run("should combine all labels", func(t *testing.T) {
		rule := generateRule()

		extraLabels := ngmodels.GenerateAlertLabels(5, "extra-")
		result := eval.Result{
			Instance: ngmodels.GenerateAlertLabels(5, "result-"),
		}
		state := newState(context.Background(), l, rule, result, extraLabels, url)
		for key, expected := range extraLabels {
			require.Equal(t, expected, state.Labels[key])
		}
		assert.Len(t, state.Labels, len(extraLabels)+len(rule.Labels)+len(result.Instance))
		for key, expected := range extraLabels {
			assert.Equal(t, expected, state.Labels[key])
		}
		for key, expected := range rule.Labels {
			assert.Equal(t, expected, state.Labels[key])
		}
		for key, expected := range result.Instance {
			assert.Equal(t, expected, state.Labels[key])
		}
	})
	t.Run("extra labels should take precedence over rule and result labels", func(t *testing.T) {
		rule := generateRule()

		extraLabels := ngmodels.GenerateAlertLabels(2, "extra-")

		result := eval.Result{
			Instance: ngmodels.GenerateAlertLabels(5, "result-"),
		}
		for key := range extraLabels {
			rule.Labels[key] = "rule-" + util.GenerateShortUID()
			result.Instance[key] = "result-" + util.GenerateShortUID()
		}

		state := newState(context.Background(), l, rule, result, extraLabels, url)
		for key, expected := range extraLabels {
			require.Equal(t, expected, state.Labels[key])
		}
	})
	t.Run("rule labels should take precedence over result labels", func(t *testing.T) {
		rule := generateRule()

		extraLabels := ngmodels.GenerateAlertLabels(2, "extra-")

		result := eval.Result{
			Instance: ngmodels.GenerateAlertLabels(5, "result-"),
		}
		for key := range rule.Labels {
			result.Instance[key] = "result-" + util.GenerateShortUID()
		}
		state := newState(context.Background(), l, rule, result, extraLabels, url)
		for key, expected := range rule.Labels {
			require.Equal(t, expected, state.Labels[key])
		}
	})
	t.Run("rule labels should be able to be expanded with result and extra labels", func(t *testing.T) {
		result := eval.Result{
			Instance: ngmodels.GenerateAlertLabels(5, "result-"),
		}
		rule := generateRule()

		extraLabels := ngmodels.GenerateAlertLabels(2, "extra-")

		labelTemplates := make(data.Labels)
		for key := range extraLabels {
			labelTemplates["rule-"+key] = fmt.Sprintf("{{ with (index .Labels \"%s\") }}{{.}}{{end}}", key)
		}
		for key := range result.Instance {
			labelTemplates["rule-"+key] = fmt.Sprintf("{{ with (index .Labels \"%s\") }}{{.}}{{end}}", key)
		}
		rule.Labels = labelTemplates

		state := newState(context.Background(), l, rule, result, extraLabels, url)
		for key, expected := range extraLabels {
			assert.Equal(t, expected, state.Labels["rule-"+key])
		}
		for key, expected := range result.Instance {
			assert.Equal(t, expected, state.Labels["rule-"+key])
		}
	})
	t.Run("rule annotations should be able to be expanded with result and extra labels", func(t *testing.T) {
		result := eval.Result{
			Instance: ngmodels.GenerateAlertLabels(5, "result-"),
		}

		rule := generateRule()

		extraLabels := ngmodels.GenerateAlertLabels(2, "extra-")

		annotationTemplates := make(data.Labels)
		for key := range extraLabels {
			annotationTemplates["rule-"+key] = fmt.Sprintf("{{ with (index .Labels \"%s\") }}{{.}}{{end}}", key)
		}
		for key := range result.Instance {
			annotationTemplates["rule-"+key] = fmt.Sprintf("{{ with (index .Labels \"%s\") }}{{.}}{{end}}", key)
		}
		rule.Annotations = annotationTemplates

		state := newState(context.Background(), l, rule, result, extraLabels, url)
		for key, expected := range extraLabels {
			assert.Equal(t, expected, state.Annotations["rule-"+key])
		}
		for key, expected := range result.Instance {
			assert.Equal(t, expected, state.Annotations["rule-"+key])
		}
	})
	t.Run("when result labels collide with system labels from LabelsUserCannotSpecify", func(t *testing.T) {
		result := eval.Result{
			Instance: ngmodels.GenerateAlertLabels(5, "result-"),
		}
		m := ngmodels.LabelsUserCannotSpecify
		t.Cleanup(func() {
			ngmodels.LabelsUserCannotSpecify = m
		})

		ngmodels.LabelsUserCannotSpecify = map[string]struct{}{
			"__label1__": {},
			"label2__":   {},
			"__label3":   {},
			"label4":     {},
		}
		result.Instance["__label1__"] = uuid.NewString()
		result.Instance["label2__"] = uuid.NewString()
		result.Instance["__label3"] = uuid.NewString()
		result.Instance["label4"] = uuid.NewString()

		rule := generateRule()

		state := newState(context.Background(), l, rule, result, nil, url)

		for key := range ngmodels.LabelsUserCannotSpecify {
			assert.NotContains(t, state.Labels, key)
		}
		assert.Contains(t, state.Labels, "label1")
		assert.Equal(t, state.Labels["label1"], result.Instance["__label1__"])

		assert.Contains(t, state.Labels, "label2")
		assert.Equal(t, state.Labels["label2"], result.Instance["label2__"])

		assert.Contains(t, state.Labels, "label3")
		assert.Equal(t, state.Labels["label3"], result.Instance["__label3"])

		assert.Contains(t, state.Labels, "label4_user")
		assert.Equal(t, state.Labels["label4_user"], result.Instance["label4"])

		t.Run("should drop label if renamed collides with existing", func(t *testing.T) {
			result.Instance["label1"] = uuid.NewString()
			result.Instance["label1_user"] = uuid.NewString()
			result.Instance["label4_user"] = uuid.NewString()

			state = newState(context.Background(), l, rule, result, nil, url)
			assert.NotContains(t, state.Labels, "__label1__")
			assert.Contains(t, state.Labels, "label1")
			assert.Equal(t, state.Labels["label1"], result.Instance["label1"])
			assert.Equal(t, state.Labels["label1_user"], result.Instance["label1_user"])

			assert.NotContains(t, state.Labels, "label4")
			assert.Equal(t, state.Labels["label4_user"], result.Instance["label4_user"])
		})
	})

	t.Run("creates a state with preset fields if there is no current state", func(t *testing.T) {
		rule := generateRule()

		extraLabels := ngmodels.GenerateAlertLabels(2, "extra-")

		result := eval.Result{
			Instance: ngmodels.GenerateAlertLabels(5, "result-"),
		}

		expectedLbl, expectedAnn := expandAnnotationsAndLabels(context.Background(), l, rule, result, extraLabels, url)

		state := newState(context.Background(), l, rule, result, extraLabels, url)

		assert.Equal(t, rule.OrgID, state.OrgID)
		assert.Equal(t, rule.UID, state.AlertRuleUID)
		assert.Equal(t, state.Labels.Fingerprint(), state.CacheID)
		assert.Equal(t, result.State, state.State)
		assert.Equal(t, "", state.StateReason)
		assert.Equal(t, result.Instance.Fingerprint(), state.ResultFingerprint)
		assert.Nil(t, state.LatestResult)
		assert.Nil(t, state.Error)
		assert.Nil(t, state.Image)
		assert.EqualValues(t, expectedAnn, state.Annotations)
		assert.EqualValues(t, expectedLbl, state.Labels)
		assert.Nil(t, state.Values)
		assert.Equal(t, result.EvaluatedAt, state.StartsAt)
		assert.Equal(t, result.EvaluatedAt, state.EndsAt)
		assert.Nil(t, state.ResolvedAt)
		assert.Nil(t, state.LastSentAt)
		assert.Equal(t, "", state.LastEvaluationString)
		assert.Equal(t, result.EvaluatedAt, state.LastEvaluationTime)
		assert.Equal(t, result.EvaluationDuration, state.EvaluationDuration)
	})
}

func TestPatch(t *testing.T) {
	key := ngmodels.GenerateRuleKey(1)
	t.Run("it populates some fields from the current state if it exists", func(t *testing.T) {
		result := eval.Result{
			Instance: ngmodels.GenerateAlertLabels(5, "result-"),
		}

		state := randomSate(key)
		orig := state.Copy()
		current := randomSate(key)

		patch(&state, &current, result)

		// Fields that should not change
		assert.Equal(t, orig.OrgID, state.OrgID)
		assert.Equal(t, orig.AlertRuleUID, state.AlertRuleUID)
		assert.Equal(t, orig.CacheID, state.CacheID)
		assert.Equal(t, orig.ResultFingerprint, state.ResultFingerprint)
		assert.EqualValues(t, orig.Annotations, state.Annotations)
		assert.EqualValues(t, orig.Labels, state.Labels)
		assert.Equal(t, orig.LastEvaluationTime, state.LastEvaluationTime)
		assert.Equal(t, orig.EvaluationDuration, state.EvaluationDuration)

		assert.Equal(t, current.State, state.State)
		assert.Equal(t, current.StateReason, state.StateReason)
		assert.Equal(t, current.Image, state.Image)
		assert.Equal(t, current.LatestResult, state.LatestResult)
		assert.Equal(t, current.Error, state.Error)
		assert.Equal(t, current.Values, state.Values)
		assert.Equal(t, current.StartsAt, state.StartsAt)
		assert.Equal(t, current.EndsAt, state.EndsAt)
		assert.Equal(t, current.ResolvedAt, state.ResolvedAt)
		assert.Equal(t, current.LastSentAt, state.LastSentAt)
		assert.Equal(t, current.LastEvaluationString, state.LastEvaluationString)
	})

	t.Run("copies system-owned annotations from current state", func(t *testing.T) {
		state := randomSate(key)
		orig := state.Copy()
		expectedAnnotations := data.Labels(state.Annotations).Copy()
		current := randomSate(key)

		for key := range ngmodels.InternalAnnotationNameSet {
			val := util.GenerateShortUID()
			current.Annotations[key] = val
			expectedAnnotations[key] = val
		}

		result := eval.Result{
			Instance: ngmodels.GenerateAlertLabels(5, "result-"),
		}

		patch(&state, &current, result)

		assert.EqualValues(t, expectedAnnotations, state.Annotations)
		assert.Equal(t, current.State, state.State)
		assert.Equal(t, current.StateReason, state.StateReason)
		assert.Equal(t, current.Image, state.Image)
		assert.Equal(t, current.LatestResult, state.LatestResult)
		assert.Equal(t, current.Error, state.Error)
		assert.Equal(t, current.Values, state.Values)
		assert.Equal(t, current.StartsAt, state.StartsAt)
		assert.Equal(t, current.EndsAt, state.EndsAt)
		assert.Equal(t, current.ResolvedAt, state.ResolvedAt)
		assert.Equal(t, current.LastSentAt, state.LastSentAt)
		assert.Equal(t, current.LastEvaluationString, state.LastEvaluationString)

		// Fields that should not change
		assert.Equal(t, orig.OrgID, state.OrgID)
		assert.Equal(t, orig.AlertRuleUID, state.AlertRuleUID)
		assert.Equal(t, orig.CacheID, state.CacheID)
		assert.Equal(t, orig.ResultFingerprint, state.ResultFingerprint)
		assert.EqualValues(t, orig.Labels, state.Labels)
		assert.Equal(t, orig.LastEvaluationTime, state.LastEvaluationTime)
		assert.Equal(t, orig.EvaluationDuration, state.EvaluationDuration)
	})

	t.Run("if result Error and current state is Error it should copy datasource_uid and ref_id labels", func(t *testing.T) {
		state := randomSate(key)
		orig := state.Copy()
		current := randomSate(key)
		current.State = eval.Error
		current.Labels["datasource_uid"] = util.GenerateShortUID()
		current.Labels["ref_id"] = util.GenerateShortUID()

		result := eval.Result{
			Instance: ngmodels.GenerateAlertLabels(5, "result-"),
			State:    eval.Error,
		}

		expectedLabels := orig.Labels.Copy()
		expectedLabels["datasource_uid"] = current.Labels["datasource_uid"]
		expectedLabels["ref_id"] = current.Labels["ref_id"]

		patch(&state, &current, result)

		assert.Equal(t, expectedLabels, state.Labels)
		assert.Equal(t, current.State, state.State)
		assert.Equal(t, current.StateReason, state.StateReason)
		assert.Equal(t, current.Image, state.Image)
		assert.Equal(t, current.LatestResult, state.LatestResult)
		assert.Equal(t, current.Error, state.Error)
		assert.Equal(t, current.Values, state.Values)
		assert.Equal(t, current.StartsAt, state.StartsAt)
		assert.Equal(t, current.EndsAt, state.EndsAt)
		assert.Equal(t, current.ResolvedAt, state.ResolvedAt)
		assert.Equal(t, current.LastSentAt, state.LastSentAt)
		assert.Equal(t, current.LastEvaluationString, state.LastEvaluationString)

		// Fields that should not change
		assert.Equal(t, orig.OrgID, state.OrgID)
		assert.Equal(t, orig.AlertRuleUID, state.AlertRuleUID)
		assert.Equal(t, orig.CacheID, state.CacheID)
		assert.Equal(t, orig.ResultFingerprint, state.ResultFingerprint)
		assert.Equal(t, orig.LastEvaluationTime, state.LastEvaluationTime)
		assert.Equal(t, orig.EvaluationDuration, state.EvaluationDuration)
		assert.EqualValues(t, orig.Annotations, state.Annotations)
	})
}

func TestResultStateReason(t *testing.T) {
	gen := ngmodels.RuleGen
	tests := []struct {
		name     string
		result   eval.Result
		rule     *ngmodels.AlertRule
		expected string
	}{
		{
			name: "Error state with KeepLast",
			result: eval.Result{
				State: eval.Error,
			},
			rule:     gen.With(ngmodels.RuleMuts.WithErrorExecAs(ngmodels.KeepLastErrState)).GenerateRef(),
			expected: "Error, KeepLast",
		},
		{
			name: "Error state without KeepLast",
			result: eval.Result{
				State: eval.Error,
			},
			rule:     gen.With(ngmodels.RuleMuts.WithErrorExecAs(ngmodels.ErrorErrState)).GenerateRef(),
			expected: "Error",
		},
		{
			name: "NoData state with KeepLast state",
			result: eval.Result{
				State: eval.NoData,
			},
			rule:     gen.With(ngmodels.RuleMuts.WithNoDataExecAs(ngmodels.KeepLast)).GenerateRef(),
			expected: "NoData, KeepLast",
		},
		{
			name: "NoData state without KeepLast",
			result: eval.Result{
				State: eval.NoData,
			},
			rule:     gen.With(ngmodels.RuleMuts.WithNoDataExecAs(ngmodels.NoData)).GenerateRef(),
			expected: "NoData",
		},
		{
			name: "Normal state",
			result: eval.Result{
				State: eval.NoData,
			},
			rule:     gen.With(ngmodels.RuleMuts.WithErrorExecAs(ngmodels.ErrorErrState), ngmodels.RuleMuts.WithNoDataExecAs(ngmodels.NoData)).GenerateRef(),
			expected: "NoData",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := resultStateReason(tc.result, tc.rule)
			assert.Equal(t, tc.expected, result)
		})
	}
}
