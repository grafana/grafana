package writer

import (
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

const RemoteWriteEndpoint = "/api/v1/write"

type TestRemoteWriteTarget struct {
	srv *httptest.Server

	mtx             sync.Mutex
	RequestsCount   int
	LastRequestBody string
	LastHeaders     http.Header

	ExpectedPath string
}

func NewTestRemoteWriteTarget(t *testing.T) *TestRemoteWriteTarget {
	t.Helper()

	target := &TestRemoteWriteTarget{
		RequestsCount:   0,
		LastRequestBody: "",
		LastHeaders:     http.Header{},
		ExpectedPath:    RemoteWriteEndpoint,
	}

	handler := func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != target.ExpectedPath {
			require.Fail(t, "Received unexpected request for endpoint %s", r.URL.Path)
		}

		target.mtx.Lock()
		defer target.mtx.Unlock()
		target.RequestsCount += 1
		target.LastHeaders = r.Header.Clone()
		bd, err := io.ReadAll(r.Body)
		defer func() {
			_ = r.Body.Close()
		}()
		require.NoError(t, err)
		target.LastRequestBody = string(bd)

		w.WriteHeader(http.StatusOK)
		_, err = w.Write([]byte(`{}`))
		require.NoError(t, err)
	}
	server := httptest.NewServer(http.HandlerFunc(handler))
	target.srv = server

	return target
}

func (s *TestRemoteWriteTarget) Close() {
	s.srv.Close()
}

func (s *TestRemoteWriteTarget) DatasourceURL() string {
	return s.srv.URL
}

func (s *TestRemoteWriteTarget) ClientSettings() setting.RecordingRuleSettings {
	return setting.RecordingRuleSettings{
		Timeout: 1 * time.Second,
	}
}

// Reset resets all tracked requests and counters.
func (s *TestRemoteWriteTarget) Reset() {
	s.mtx.Lock()
	defer s.mtx.Unlock()
	s.RequestsCount = 0
	s.LastRequestBody = ""
	s.LastHeaders = http.Header{}
}
