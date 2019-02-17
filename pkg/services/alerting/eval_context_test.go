package alerting

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/models"
)

func TestStateIsUpdatedWhenNeeded(t *testing.T) {
	ctx := NewEvalContext(context.TODO(), &Rule{Conditions: []Condition{&conditionStub{firing: true}}})

	t.Run("ok -> alerting", func(t *testing.T) {
		ctx.PrevAlertState = models.AlertStateOK
		ctx.Rule.State = models.AlertStateAlerting

		if !ctx.ShouldUpdateAlertState() {
			t.Fatalf("expected should updated to be true")
		}
	})

	t.Run("ok -> ok", func(t *testing.T) {
		ctx.PrevAlertState = models.AlertStateOK
		ctx.Rule.State = models.AlertStateOK

		if ctx.ShouldUpdateAlertState() {
			t.Fatalf("expected should updated to be false")
		}
	})
}

func TestGetStateFromEvalContext(t *testing.T) {
	tcs := []struct {
		name     string
		expected models.AlertStateType
		applyFn  func(ec *EvalContext)
	}{
		{
			name:     "ok -> alerting",
			expected: models.AlertStateAlerting,
			applyFn: func(ec *EvalContext) {
				ec.Firing = true
				ec.PrevAlertState = models.AlertStateOK
			},
		},
		{
			name:     "ok -> error(alerting)",
			expected: models.AlertStateAlerting,
			applyFn: func(ec *EvalContext) {
				ec.PrevAlertState = models.AlertStateOK
				ec.Error = errors.New("test error")
				ec.Rule.ExecutionErrorState = models.ExecutionErrorSetAlerting
			},
		},
		{
			name:     "ok -> pending. since its been firing for less than FOR",
			expected: models.AlertStatePending,
			applyFn: func(ec *EvalContext) {
				ec.PrevAlertState = models.AlertStateOK
				ec.Firing = true
				ec.Rule.LastStateChange = time.Now().Add(-time.Minute * 2)
				ec.Rule.For = time.Minute * 5
			},
		},
		{
			name:     "ok -> pending. since it has to be pending longer than FOR and prev state is ok",
			expected: models.AlertStatePending,
			applyFn: func(ec *EvalContext) {
				ec.PrevAlertState = models.AlertStateOK
				ec.Firing = true
				ec.Rule.LastStateChange = time.Now().Add(-(time.Hour * 5))
				ec.Rule.For = time.Minute * 2
			},
		},
		{
			name:     "pending -> alerting. since its been firing for more than FOR and prev state is pending",
			expected: models.AlertStateAlerting,
			applyFn: func(ec *EvalContext) {
				ec.PrevAlertState = models.AlertStatePending
				ec.Firing = true
				ec.Rule.LastStateChange = time.Now().Add(-(time.Hour * 5))
				ec.Rule.For = time.Minute * 2
			},
		},
		{
			name:     "alerting -> alerting. should not update regardless of FOR",
			expected: models.AlertStateAlerting,
			applyFn: func(ec *EvalContext) {
				ec.PrevAlertState = models.AlertStateAlerting
				ec.Firing = true
				ec.Rule.LastStateChange = time.Now().Add(-time.Minute * 5)
				ec.Rule.For = time.Minute * 2
			},
		},
		{
			name:     "ok -> ok. should not update regardless of FOR",
			expected: models.AlertStateOK,
			applyFn: func(ec *EvalContext) {
				ec.PrevAlertState = models.AlertStateOK
				ec.Rule.LastStateChange = time.Now().Add(-time.Minute * 5)
				ec.Rule.For = time.Minute * 2
			},
		},
		{
			name:     "ok -> error(keep_last)",
			expected: models.AlertStateOK,
			applyFn: func(ec *EvalContext) {
				ec.PrevAlertState = models.AlertStateOK
				ec.Error = errors.New("test error")
				ec.Rule.ExecutionErrorState = models.ExecutionErrorKeepState
			},
		},
		{
			name:     "pending -> error(keep_last)",
			expected: models.AlertStatePending,
			applyFn: func(ec *EvalContext) {
				ec.PrevAlertState = models.AlertStatePending
				ec.Error = errors.New("test error")
				ec.Rule.ExecutionErrorState = models.ExecutionErrorKeepState
			},
		},
		{
			name:     "ok -> no_data(alerting)",
			expected: models.AlertStateAlerting,
			applyFn: func(ec *EvalContext) {
				ec.PrevAlertState = models.AlertStateOK
				ec.Rule.NoDataState = models.NoDataSetAlerting
				ec.NoDataFound = true
			},
		},
		{
			name:     "ok -> no_data(keep_last)",
			expected: models.AlertStateOK,
			applyFn: func(ec *EvalContext) {
				ec.PrevAlertState = models.AlertStateOK
				ec.Rule.NoDataState = models.NoDataKeepState
				ec.NoDataFound = true
			},
		},
		{
			name:     "pending -> no_data(keep_last)",
			expected: models.AlertStatePending,
			applyFn: func(ec *EvalContext) {
				ec.PrevAlertState = models.AlertStatePending
				ec.Rule.NoDataState = models.NoDataKeepState
				ec.NoDataFound = true
			},
		},
		{
			name:     "pending -> no_data(alerting) with for duration have not passed",
			expected: models.AlertStatePending,
			applyFn: func(ec *EvalContext) {
				ec.PrevAlertState = models.AlertStatePending
				ec.Rule.NoDataState = models.NoDataSetAlerting
				ec.NoDataFound = true
				ec.Rule.For = time.Minute * 5
				ec.Rule.LastStateChange = time.Now().Add(-time.Minute * 2)
			},
		},
		{
			name:     "pending -> no_data(alerting) should set alerting since time passed FOR",
			expected: models.AlertStateAlerting,
			applyFn: func(ec *EvalContext) {
				ec.PrevAlertState = models.AlertStatePending
				ec.Rule.NoDataState = models.NoDataSetAlerting
				ec.NoDataFound = true
				ec.Rule.For = time.Minute * 2
				ec.Rule.LastStateChange = time.Now().Add(-time.Minute * 5)
			},
		},
		{
			name:     "pending -> error(alerting) with for duration have not passed ",
			expected: models.AlertStatePending,
			applyFn: func(ec *EvalContext) {
				ec.PrevAlertState = models.AlertStatePending
				ec.Rule.ExecutionErrorState = models.ExecutionErrorSetAlerting
				ec.Error = errors.New("test error")
				ec.Rule.For = time.Minute * 5
				ec.Rule.LastStateChange = time.Now().Add(-time.Minute * 2)
			},
		},
		{
			name:     "pending -> error(alerting) should set alerting since time passed FOR",
			expected: models.AlertStateAlerting,
			applyFn: func(ec *EvalContext) {
				ec.PrevAlertState = models.AlertStatePending
				ec.Rule.ExecutionErrorState = models.ExecutionErrorSetAlerting
				ec.Error = errors.New("test error")
				ec.Rule.For = time.Minute * 2
				ec.Rule.LastStateChange = time.Now().Add(-time.Minute * 5)
			},
		},
	}

	for _, tc := range tcs {
		ctx := NewEvalContext(context.TODO(), &Rule{Conditions: []Condition{&conditionStub{firing: true}}})

		tc.applyFn(ctx)
		have := ctx.GetNewState()
		if have != tc.expected {
			t.Errorf("failed: %s \n expected '%s' have '%s'\n", tc.name, tc.expected, string(have))
		}
	}
}
