package alerting

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

func TestStateIsUpdatedWhenNeeded(t *testing.T) {
	ctx := NewEvalContext(context.TODO(), &Rule{Conditions: []Condition{&conditionStub{firing: true}}})

	t.Run("ok -> alerting", func(t *testing.T) {
		ctx.PrevAlertState = models.AlertStateOK
		ctx.Rule.State = models.AlertStateAlerting

		if !ctx.shouldUpdateAlertState() {
			t.Fatalf("expected should updated to be true")
		}
	})

	t.Run("ok -> ok", func(t *testing.T) {
		ctx.PrevAlertState = models.AlertStateOK
		ctx.Rule.State = models.AlertStateOK

		if ctx.shouldUpdateAlertState() {
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
		evalContext := NewEvalContext(context.Background(), &Rule{Conditions: []Condition{&conditionStub{firing: true}}})

		tc.applyFn(evalContext)
		newState := evalContext.GetNewState()
		assert.Equal(t, tc.expected, newState, "failed: %s \n expected '%s' have '%s'\n", tc.name, tc.expected, string(newState))
	}
}

func TestGetRuleURL(t *testing.T) {
	dashboardRef, dashboardSlug := "1", "test-dashboard"
	setting.AppUrl = "http://localhost:12345/"
	bus.AddHandler("test", func(query *models.GetDashboardRefByIdQuery) error {
		query.Result = &models.DashboardRef{Uid: dashboardRef, Slug: dashboardSlug}
		return nil
	})
	lastStateChange := time.Date(2019, 12, 30, 17, 34, 11, 0, time.UTC)
	from := lastStateChange.Unix() * 1000
	forDuration := 1 * time.Minute
	to := lastStateChange.Add(forDuration).Unix() * 1000

	ctx := NewEvalContext(context.TODO(), &Rule{PanelID: 1, OrgID: 2, LastStateChange: lastStateChange, For: forDuration})
	u, err := ctx.GetRuleURL()
	assert.NoError(t, err)
	expected := fmt.Sprintf(urlFormat+"&from=%d&to=%d", models.GetFullDashboardUrl(dashboardRef, dashboardSlug), 1, 2, from, to)
	assert.Equal(t, expected, u)
}
