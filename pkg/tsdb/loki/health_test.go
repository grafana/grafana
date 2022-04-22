package loki

import (
	"context"
	"fmt"
	"strings"
	"testing"

	gokitlog "github.com/go-kit/log"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/stretchr/testify/require"
)

func TestHealthCheck(t *testing.T) {
	t.Run("success with labels", func(t *testing.T) {
		api := makeMockedAPI(200, "text/plain; charset=utf-8", []byte(`{"status":"success","data":["name1","name2"]}`), nil)

		result, err := checkHealth(context.Background(), api, log.New("test"))
		require.NoError(t, err)
		require.Equal(t, backend.HealthStatusOk, result.Status)
		require.Equal(t, "Data source connected, labels found", result.Message)
	})

	t.Run("success without labels", func(t *testing.T) {
		api := makeMockedAPI(200, "text/plain; charset=utf-8", []byte(`{"status":"success","data":[]}`), nil)

		result, err := checkHealth(context.Background(), api, log.New("test"))
		require.NoError(t, err)
		require.Equal(t, backend.HealthStatusOk, result.Status)
		require.Equal(t, "Data source connected, but no labels found", result.Message)
	})

	t.Run("error in json-status", func(t *testing.T) {
		api := makeMockedAPI(200, "text/plain; charset=utf-8", []byte(`{"status":"error"}`), nil)

		result, err := checkHealth(context.Background(), api, log.New("test"))
		require.NoError(t, err)
		require.Equal(t, backend.HealthStatusError, result.Status)
		require.Equal(t, "Loki returned an error response", result.Message)
	})

	t.Run("invalid JSON", func(t *testing.T) {
		api := makeMockedAPI(200, "text/plain; charset=utf-8", []byte(`{"sta`), nil)

		result, err := checkHealth(context.Background(), api, log.New("test"))
		require.NoError(t, err)
		require.Equal(t, backend.HealthStatusError, result.Status)
		require.Equal(t, "Loki returned invalid JSON data", result.Message)
	})

	t.Run("API error", func(t *testing.T) {
		seenLog := false

		// we setup a custom logger, and we check if we logged what we need to log
		logger := gokitlog.Logger(gokitlog.LoggerFunc(func(keyvals ...interface{}) error {
			// the `keyvals` array contains the log-item.
			// as we logged it as `log.Error("Loki Query error", "err", error-object)`
			// those 3 things become the last 3 items of the keyvals array
			message := keyvals[len(keyvals)-3]
			key := keyvals[len(keyvals)-2]
			// this is not a string, and we need to do a string operation on it,
			// so we convert it to a string
			value := fmt.Sprintf("%v", keyvals[len(keyvals)-1])

			if (message == "Loki Query error") && (key == "err") && (strings.Contains(value, "mocked error")) {
				seenLog = true
			}

			return nil
		}))

		testLogger := log.New("test")
		testLogger.Swap(logger)

		err := fmt.Errorf("mocked error")
		api := makeMockedAPI(200, "text/plain; charset=utf-8", []byte(`{"sta`), err)

		result, err := checkHealth(context.Background(), api, testLogger)
		require.NoError(t, err)
		require.Equal(t, backend.HealthStatusError, result.Status)
		require.Equal(t, "Loki connection error. please inspect the Grafana server log for details", result.Message)
		require.True(t, seenLog)
	})
}
