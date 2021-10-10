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
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
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
	Convey("Alerting engine job processing", t, func() {
		bus := bus.New()
		usMock := &usagestats.UsageStatsMock{T: t}
		engine := ProvideAlertEngine(nil, bus, nil, nil, usMock, secrets.SetupTestService(t), setting.NewCfg())
		setting.AlertingEvaluationTimeout = 30 * time.Second
		setting.AlertingNotificationTimeout = 30 * time.Second
		setting.AlertingMaxAttempts = 3
		engine.resultHandler = &FakeResultHandler{}
		job := &Job{running: true, Rule: &Rule{}}

		Convey("Should register usage metrics func", func() {
			bus.AddHandler(func(q *models.GetAllAlertsQuery) error {
				settings, err := simplejson.NewJson([]byte(`{"conditions": [{"query": { "datasourceId": 1}}]}`))
				if err != nil {
					return err
				}
				q.Result = []*models.Alert{{Settings: settings}}
				return nil
			})

			bus.AddHandler(func(q *models.GetDataSourceQuery) error {
				q.Result = &models.DataSource{Id: 1, Type: models.DS_PROMETHEUS}
				return nil
			})

			report, err := usMock.GetUsageReport(context.Background())
			So(err, ShouldBeNil)

			So(report.Metrics["stats.alerting.ds.prometheus.count"], ShouldEqual, 1)
			So(report.Metrics["stats.alerting.ds.other.count"], ShouldEqual, 0)
		})

		Convey("Should trigger retry if needed", func() {
			Convey("error + not last attempt -> retry", func() {
				engine.evalHandler = NewFakeEvalHandler(0)

				for i := 1; i < setting.AlertingMaxAttempts; i++ {
					attemptChan := make(chan int, 1)
					cancelChan := make(chan context.CancelFunc, setting.AlertingMaxAttempts)

					engine.processJob(i, attemptChan, cancelChan, job)
					nextAttemptID, more := <-attemptChan

					So(nextAttemptID, ShouldEqual, i+1)
					So(more, ShouldEqual, true)
					So(<-cancelChan, ShouldNotBeNil)
				}
			})

			Convey("error + last attempt -> no retry", func() {
				engine.evalHandler = NewFakeEvalHandler(0)
				attemptChan := make(chan int, 1)
				cancelChan := make(chan context.CancelFunc, setting.AlertingMaxAttempts)

				engine.processJob(setting.AlertingMaxAttempts, attemptChan, cancelChan, job)
				nextAttemptID, more := <-attemptChan

				So(nextAttemptID, ShouldEqual, 0)
				So(more, ShouldEqual, false)
				So(<-cancelChan, ShouldNotBeNil)
			})

			Convey("no error -> no retry", func() {
				engine.evalHandler = NewFakeEvalHandler(1)
				attemptChan := make(chan int, 1)
				cancelChan := make(chan context.CancelFunc, setting.AlertingMaxAttempts)

				engine.processJob(1, attemptChan, cancelChan, job)
				nextAttemptID, more := <-attemptChan

				So(nextAttemptID, ShouldEqual, 0)
				So(more, ShouldEqual, false)
				So(<-cancelChan, ShouldNotBeNil)
			})
		})

		Convey("Should trigger as many retries as needed", func() {
			Convey("never success -> max retries number", func() {
				expectedAttempts := setting.AlertingMaxAttempts
				evalHandler := NewFakeEvalHandler(0)
				engine.evalHandler = evalHandler

				err := engine.processJobWithRetry(context.TODO(), job)
				So(err, ShouldBeNil)
				So(evalHandler.CallNb, ShouldEqual, expectedAttempts)
			})

			Convey("always success -> never retry", func() {
				expectedAttempts := 1
				evalHandler := NewFakeEvalHandler(1)
				engine.evalHandler = evalHandler

				err := engine.processJobWithRetry(context.TODO(), job)
				So(err, ShouldBeNil)
				So(evalHandler.CallNb, ShouldEqual, expectedAttempts)
			})

			Convey("some errors before success -> some retries", func() {
				expectedAttempts := int(math.Ceil(float64(setting.AlertingMaxAttempts) / 2))
				evalHandler := NewFakeEvalHandler(expectedAttempts)
				engine.evalHandler = evalHandler

				err := engine.processJobWithRetry(context.TODO(), job)
				So(err, ShouldBeNil)
				So(evalHandler.CallNb, ShouldEqual, expectedAttempts)
			})
		})
	})
}
