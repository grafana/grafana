package alerting

import (
	"context"
	"errors"
	"math"
	"testing"

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

func (handler *FakeResultHandler) Handle(evalContext *EvalContext) error {
	return nil
}

func TestEngineProcessJob(t *testing.T) {
	Convey("Alerting engine job processing", t, func() {
		engine := NewEngine()
		engine.resultHandler = &FakeResultHandler{}
		job := &Job{Running: true, Rule: &Rule{}}

		Convey("Should trigger retry if needed", func() {

			Convey("error + not last attempt -> retry", func() {
				engine.evalHandler = NewFakeEvalHandler(0)

				for i := 1; i < alertMaxAttempts; i++ {
					attemptChan := make(chan int, 1)
					cancelChan := make(chan context.CancelFunc, alertMaxAttempts)

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
				cancelChan := make(chan context.CancelFunc, alertMaxAttempts)

				engine.processJob(alertMaxAttempts, attemptChan, cancelChan, job)
				nextAttemptID, more := <-attemptChan

				So(nextAttemptID, ShouldEqual, 0)
				So(more, ShouldEqual, false)
				So(<-cancelChan, ShouldNotBeNil)
			})

			Convey("no error -> no retry", func() {
				engine.evalHandler = NewFakeEvalHandler(1)
				attemptChan := make(chan int, 1)
				cancelChan := make(chan context.CancelFunc, alertMaxAttempts)

				engine.processJob(1, attemptChan, cancelChan, job)
				nextAttemptID, more := <-attemptChan

				So(nextAttemptID, ShouldEqual, 0)
				So(more, ShouldEqual, false)
				So(<-cancelChan, ShouldNotBeNil)
			})
		})

		Convey("Should trigger as many retries as needed", func() {

			Convey("never success -> max retries number", func() {
				expectedAttempts := alertMaxAttempts
				evalHandler := NewFakeEvalHandler(0)
				engine.evalHandler = evalHandler

				engine.processJobWithRetry(context.TODO(), job)
				So(evalHandler.CallNb, ShouldEqual, expectedAttempts)
			})

			Convey("always success -> never retry", func() {
				expectedAttempts := 1
				evalHandler := NewFakeEvalHandler(1)
				engine.evalHandler = evalHandler

				engine.processJobWithRetry(context.TODO(), job)
				So(evalHandler.CallNb, ShouldEqual, expectedAttempts)
			})

			Convey("some errors before success -> some retries", func() {
				expectedAttempts := int(math.Ceil(float64(alertMaxAttempts) / 2))
				evalHandler := NewFakeEvalHandler(expectedAttempts)
				engine.evalHandler = evalHandler

				engine.processJobWithRetry(context.TODO(), job)
				So(evalHandler.CallNb, ShouldEqual, expectedAttempts)
			})
		})
	})
}
