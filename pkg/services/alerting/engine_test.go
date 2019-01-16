package alerting

import (
	"context"
	"errors"
	"math"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

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

type FakeCommonTimeoutHandler struct {
	TransportTimeoutDuration time.Duration
	ServerBusySleepDuration  time.Duration
	EvalSucceed              bool
	ResultHandleSucceed      bool
}

func NewFakeCommonTimeoutHandler(transportTimeoutDuration time.Duration, serverBusySleepDuration time.Duration) *FakeCommonTimeoutHandler {
	return &FakeCommonTimeoutHandler{
		TransportTimeoutDuration: transportTimeoutDuration,
		ServerBusySleepDuration:  serverBusySleepDuration,
		EvalSucceed:              false,
		ResultHandleSucceed:      false,
	}
}

func (handler *FakeCommonTimeoutHandler) Eval(evalContext *EvalContext) {
	// 1. prepare mock server
	path := "/evaltimeout"
	srv := runBusyServer(path, handler.ServerBusySleepDuration)
	defer srv.Close()

	// 2. send requests
	url := srv.URL + path
	res, err := sendRequest(evalContext.Ctx, url, handler.TransportTimeoutDuration)
	if res != nil {
		defer res.Body.Close()
	}

	if err != nil {
		evalContext.Error = errors.New("Fake evaluation timeout test failure")
		return
	}

	if res.StatusCode == 200 {
		handler.EvalSucceed = true
	}

	evalContext.Error = errors.New("Fake evaluation timeout test failure; wrong response")
}

func (handler *FakeCommonTimeoutHandler) Handle(evalContext *EvalContext) error {
	// 1. prepare mock server
	path := "/resulthandle"
	srv := runBusyServer(path, handler.ServerBusySleepDuration)
	defer srv.Close()

	// 2. send requests
	url := srv.URL + path
	res, err := sendRequest(evalContext.Ctx, url, handler.TransportTimeoutDuration)
	if res != nil {
		defer res.Body.Close()
	}

	if err != nil {
		evalContext.Error = errors.New("Fake result handle timeout test failure")
		return evalContext.Error
	}

	if res.StatusCode == 200 {
		handler.ResultHandleSucceed = true
		return nil
	}

	evalContext.Error = errors.New("Fake result handle timeout test failure; wrong response")

	return evalContext.Error
}

func runBusyServer(path string, serverBusySleepDuration time.Duration) *httptest.Server {
	mux := http.NewServeMux()
	server := httptest.NewServer(mux)

	mux.HandleFunc(path, func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(serverBusySleepDuration)
	})

	return server
}

func sendRequest(context context.Context, url string, transportTimeoutInterval time.Duration) (resp *http.Response, err error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req = req.WithContext(context)

	transport := http.Transport{
		Dial: (&net.Dialer{
			Timeout:   transportTimeoutInterval,
			KeepAlive: transportTimeoutInterval,
		}).Dial,
	}
	client := http.Client{
		Transport: &transport,
	}

	return client.Do(req)
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

			Convey("pended alert for datasource -> result handler should be worked", func() {
				// reduce alert timeout to test quickly
				originAlertTimeout := alertTimeout
				alertTimeout = 5 * time.Second
				transportTimeoutInterval := 5 * time.Second
				serverBusySleepDuration := 4 * time.Second

				evalHandler := NewFakeCommonTimeoutHandler(transportTimeoutInterval, serverBusySleepDuration)
				resultHandler := NewFakeCommonTimeoutHandler(transportTimeoutInterval, serverBusySleepDuration)
				engine.evalHandler = evalHandler
				engine.resultHandler = resultHandler

				engine.processJobWithRetry(context.TODO(), job)

				So(evalHandler.EvalSucceed, ShouldEqual, true)
				So(resultHandler.ResultHandleSucceed, ShouldEqual, true)

				// initialize for other tests.
				alertTimeout = originAlertTimeout
				engine.resultHandler = &FakeResultHandler{}
			})

		})
	})
}
