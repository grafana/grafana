package alerting

import (
	"context"
	"errors"
	"math"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/encryption/ossencryption"
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
	bus := bus.New()
	usMock := &usagestats.UsageStatsMock{T: t}
	engine := ProvideAlertEngine(nil, bus, nil, nil, usMock, ossencryption.ProvideService(), setting.NewCfg())
	setting.AlertingEvaluationTimeout = 30 * time.Second
	setting.AlertingNotificationTimeout = 30 * time.Second
	setting.AlertingMaxAttempts = 3
	engine.resultHandler = &FakeResultHandler{}
	job := &Job{running: true, Rule: &Rule{}}

	t.Run("Should register usage metrics func", func(t *testing.T) {
		bus.AddHandlerCtx(func(ctx context.Context, q *models.GetAllAlertsQuery) error {
			settings, err := simplejson.NewJson([]byte(`{"conditions": [{"query": { "datasourceId": 1}}]}`))
			if err != nil {
				return err
			}
			q.Result = []*models.Alert{{Settings: settings}}
			return nil
		})

		bus.AddHandlerCtx(func(ctx context.Context, q *models.GetDataSourceQuery) error {
			q.Result = &models.DataSource{Id: 1, Type: models.DS_PROMETHEUS}
			return nil
		})

		report, err := usMock.GetUsageReport(context.Background())
		require.Nil(t, err)

		require.Equal(t, 1, report.Metrics["stats.alerting.ds.prometheus.count"])
		require.Equal(t, 0, report.Metrics["stats.alerting.ds.other.count"])
	})

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
				require.NotNil(t, <-cancelChan)
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
			require.NotNil(t, <-cancelChan)
		})

		t.Run("no error -> no retry", func(t *testing.T) {
			engine.evalHandler = NewFakeEvalHandler(1)
			attemptChan := make(chan int, 1)
			cancelChan := make(chan context.CancelFunc, setting.AlertingMaxAttempts)

			engine.processJob(1, attemptChan, cancelChan, job)
			nextAttemptID, more := <-attemptChan

			require.Equal(t, 0, nextAttemptID)
			require.Equal(t, false, more)
			require.NotNil(t, <-cancelChan)
		})
	})

	t.Run("Should trigger as many retries as needed", func(t *testing.T) {
		t.Run("never success -> max retries number", func(t *testing.T) {
			expectedAttempts := setting.AlertingMaxAttempts
			evalHandler := NewFakeEvalHandler(0)
			engine.evalHandler = evalHandler

			err := engine.processJobWithRetry(context.Background(), job)
			require.Nil(t, err)
			require.Equal(t, expectedAttempts, evalHandler.CallNb)
		})

		t.Run("always success -> never retry", func(t *testing.T) {
			expectedAttempts := 1
			evalHandler := NewFakeEvalHandler(1)
			engine.evalHandler = evalHandler

			err := engine.processJobWithRetry(context.Background(), job)
			require.Nil(t, err)
			require.Equal(t, expectedAttempts, evalHandler.CallNb)
		})

		t.Run("some errors before success -> some retries", func(t *testing.T) {
			expectedAttempts := int(math.Ceil(float64(setting.AlertingMaxAttempts) / 2))
			evalHandler := NewFakeEvalHandler(expectedAttempts)
			engine.evalHandler = evalHandler

			err := engine.processJobWithRetry(context.Background(), job)
			require.Nil(t, err)
			require.Equal(t, expectedAttempts, evalHandler.CallNb)
		})
	})
}
