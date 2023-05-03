package alerting

import (
	"context"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/infra/usagestats/validator"
	"github.com/grafana/grafana/pkg/services/annotations/annotationstest"
	datasources "github.com/grafana/grafana/pkg/services/datasources/fakes"
	encryptionprovider "github.com/grafana/grafana/pkg/services/encryption/provider"
	encryptionservice "github.com/grafana/grafana/pkg/services/encryption/service"
	"github.com/grafana/grafana/pkg/setting"
)

func TestIntegrationEngineTimeouts(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	usMock := &usagestats.UsageStatsMock{T: t}
	usValidatorMock := &validator.FakeUsageStatsValidator{}

	encProvider := encryptionprovider.ProvideEncryptionProvider()
	cfg := setting.NewCfg()
	settings := &setting.OSSImpl{Cfg: cfg}

	encService, err := encryptionservice.ProvideEncryptionService(encProvider, usMock, settings)
	require.NoError(t, err)

	tracer := tracing.InitializeTracerForTest()
	dsMock := &datasources.FakeDataSourceService{}
	annotationsRepo := annotationstest.NewFakeAnnotationsRepo()
	engine := ProvideAlertEngine(nil, nil, nil, usMock, usValidatorMock, encService, nil, tracer, nil, setting.NewCfg(), nil, nil, localcache.New(time.Minute, time.Minute), dsMock, annotationsRepo)
	setting.AlertingNotificationTimeout = 30 * time.Second
	setting.AlertingMaxAttempts = 3
	engine.resultHandler = &FakeResultHandler{}
	job := &Job{running: true, Rule: &Rule{}}

	t.Run("Should trigger as many retries as needed", func(t *testing.T) {
		t.Run("pended alert for datasource -> result handler should be worked", func(t *testing.T) {
			// reduce alert timeout to test quickly
			setting.AlertingEvaluationTimeout = 30 * time.Second
			transportTimeoutInterval := 2 * time.Second
			serverBusySleepDuration := 1 * time.Second

			evalHandler := NewFakeCommonTimeoutHandler(transportTimeoutInterval, serverBusySleepDuration)
			resultHandler := NewFakeCommonTimeoutHandler(transportTimeoutInterval, serverBusySleepDuration)
			engine.evalHandler = evalHandler
			engine.resultHandler = resultHandler

			err := engine.processJobWithRetry(context.Background(), job)
			require.Nil(t, err)

			require.Equal(t, true, evalHandler.EvalSucceed)
			require.Equal(t, true, resultHandler.ResultHandleSucceed)

			// initialize for other tests.
			setting.AlertingEvaluationTimeout = 2 * time.Second
			engine.resultHandler = &FakeResultHandler{}
		})
	})
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
		defer func() {
			if err := res.Body.Close(); err != nil {
				logger.Warn("Error", "err", err)
			}
		}()
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

func (handler *FakeCommonTimeoutHandler) handle(evalContext *EvalContext) error {
	// 1. prepare mock server
	path := "/resulthandle"
	srv := runBusyServer(path, handler.ServerBusySleepDuration)
	defer srv.Close()

	// 2. send requests
	url := srv.URL + path
	res, err := sendRequest(evalContext.Ctx, url, handler.TransportTimeoutDuration)
	if res != nil {
		defer func() {
			if err := res.Body.Close(); err != nil {
				logger.Warn("Error", "err", err)
			}
		}()
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
