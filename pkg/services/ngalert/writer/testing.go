package writer

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

const RemoteWriteEndpoint = "/api/v1/write"

type TestRemoteWriteTarget struct {
	srv *httptest.Server

	RequestsCount int
}

func NewTestRemoteWriteTarget(t *testing.T) *TestRemoteWriteTarget {
	t.Helper()

	target := &TestRemoteWriteTarget{
		RequestsCount: 0,
	}

	handler := func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != RemoteWriteEndpoint {
			require.Fail(t, "Received unexpected request for endpoint %s", r.URL.Path)
		}

		target.RequestsCount += 1
		w.WriteHeader(http.StatusOK)
		_, err := w.Write([]byte(`{}`))
		require.NoError(t, err)
	}
	server := httptest.NewServer(http.HandlerFunc(handler))
	target.srv = server

	return target
}

func (s *TestRemoteWriteTarget) Close() {
	s.srv.Close()
}

func (s *TestRemoteWriteTarget) ClientSettings() setting.RecordingRuleSettings {
	return setting.RecordingRuleSettings{
		URL:               s.srv.URL + RemoteWriteEndpoint,
		Timeout:           1 * time.Second,
		BasicAuthUsername: "",
		BasicAuthPassword: "",
	}
}
