package alerting

import (
	"context"
	"errors"
	"math"
	"testing"

	"time"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

type FakeEvalHandler struct {
	SuccessCallID int // 0 means never success
	CallNb        int
}

func NewFakeEvalHandler(successCallID int) *FakeEvalHandler {
	return &FakeEvalHandler{
		SuccessCallID: successCallID,
		CallNb:        0,
	}
}

func (handler *FakeEvalHandler) Eval(evalContext *EvalContext) {
	handler.CallNb++
	if handler.CallNb != handler.SuccessCallID {
		evalContext.Error = errors.New("Fake evaluation failure")
	}
}

type FakeResultHandler struct{}

func (handler *FakeResultHandler) handle(evalContext *EvalContext) error {
	return nil
}

func TestEngineProcessJob(t *testing.T) {
	t.Run("Alerting engine job processing", func(t *testing.T) {
		engine := &AlertEngine{}
		err := engine.Init()
		require.NoError(t, err)
		setting.AlertingEvaluationTimeout = 30 * time.Second
		setting.AlertingNotificationTimeout = 30 * time.Second
		setting.AlertingMaxAttempts = 3
		engine.resultHandler = &FakeResultHandler{}
		job := &Job{running: true, Rule: &Rule{}}

		t.Run("Should trigger retry if needed", func(t *testing.T) {
			t.Run("error + not last attempt -> retry", func(t *testing.T) {
				engine.evalHandler = NewFakeEvalHandler(0)

				for i := 1; i < setting.AlertingMaxAttempts; i++ {
					attemptChan := make(chan int, 1)
					cancelChan := make(chan context.CancelFunc, setting.AlertingMaxAttempts)

					engine.processJob(i, attemptChan, cancelChan, job)
					nextAttemptID, more := <-attemptChan

					require.Equal(t, i+1, nextAttemptID)
					require.Equal(t, true, more)
					So(<-cancelChan, ShouldNotBeNil)
				}
			})

			t.Run("error + last attempt -> no retry", func(t *testing.T) {
				engine.evalHandler = NewFakeEvalHandler(0)
				attemptChan := make(chan int, 1)
				cancelChan := make(chan context.CancelFunc, setting.AlertingMaxAttempts)

				engine.processJob(setting.AlertingMaxAttempts, attemptChan, cancelChan, job)
				nextAttemptID, more := <-attemptChan

				require.Equal(t, 0, nextAttemptID)
				require.Equal(t, false, more)
				So(<-cancelChan, ShouldNotBeNil)
			})

			t.Run("no error -> no retry", func(t *testing.T) {
				engine.evalHandler = NewFakeEvalHandler(1)
				attemptChan := make(chan int, 1)
				cancelChan := make(chan context.CancelFunc, setting.AlertingMaxAttempts)

				engine.processJob(1, attemptChan, cancelChan, job)
				nextAttemptID, more := <-attemptChan

				require.Equal(t, 0, nextAttemptID)
				require.Equal(t, false, more)
				So(<-cancelChan, ShouldNotBeNil)
			})
		})

		t.Run("Should trigger as many retries as needed", func(t *testing.T) {
			t.Run("never success -> max retries number", func(t *testing.T) {
				expectedAttempts := setting.AlertingMaxAttempts
				evalHandler := NewFakeEvalHandler(0)
				engine.evalHandler = evalHandler

				err := engine.processJobWithRetry(context.TODO(), job)
				require.NoError(t, err)
				require.Equal(t, expectedAttempts, evalHandler.CallNb)
			})

			t.Run("always success -> never retry", func(t *testing.T) {
				expectedAttempts := 1
				evalHandler := NewFakeEvalHandler(1)
				engine.evalHandler = evalHandler

				err := engine.processJobWithRetry(context.TODO(), job)
				require.NoError(t, err)
				require.Equal(t, expectedAttempts, evalHandler.CallNb)
			})

			t.Run("some errors before success -> some retries", func(t *testing.T) {
				expectedAttempts := int(math.Ceil(float64(setting.AlertingMaxAttempts) / 2))
				evalHandler := NewFakeEvalHandler(expectedAttempts)
				engine.evalHandler = evalHandler

				err := engine.processJobWithRetry(context.TODO(), job)
				require.NoError(t, err)
				require.Equal(t, expectedAttempts, evalHandler.CallNb)
			})
		})
	})
}
