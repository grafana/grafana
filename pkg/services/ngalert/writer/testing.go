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

const RemoteWritePrefix = "/api/v1"
const RemoteWriteSuffix = "/write"

const RemoteWriteEndpoint = RemoteWritePrefix + RemoteWriteSuffix

type TestRemoteWriteTarget struct {
	srv *httptest.Server

	mtx             sync.Mutex
	RequestsCount   int
	LastRequestBody string
}

func NewTestRemoteWriteTarget(t *testing.T) *TestRemoteWriteTarget {
	t.Helper()

	target := &TestRemoteWriteTarget{
		RequestsCount:   0,
		LastRequestBody: "",
	}

	handler := func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != RemoteWriteEndpoint {
			require.Fail(t, "Received unexpected request for endpoint %s", r.URL.Path)
		}

		target.mtx.Lock()
		defer target.mtx.Unlock()
		target.RequestsCount += 1
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
	return s.srv.URL + RemoteWritePrefix
}

func (s *TestRemoteWriteTarget) ClientSettings() setting.RecordingRuleSettings {
	return setting.RecordingRuleSettings{
		URL:               s.srv.URL + RemoteWriteEndpoint,
		Timeout:           1 * time.Second,
		BasicAuthUsername: "",
		BasicAuthPassword: "",
	}
}

// Reset resets all tracked requests and counters.
func (s *TestRemoteWriteTarget) Reset() {
	s.mtx.Lock()
	defer s.mtx.Unlock()
	s.RequestsCount = 0
	s.LastRequestBody = ""
}
