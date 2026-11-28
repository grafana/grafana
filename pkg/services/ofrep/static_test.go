package ofrep

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	goffmodel "github.com/thomaspoignant/go-feature-flag/cmd/relayproxy/model"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

func TestOneFlagHandler_Static(t *testing.T) {
	setupOpenFeatureFlag(t, "definedFlag", true)
	cfg, err := setting.NewCfgFromBytes([]byte("[feature_toggles]\ndefinedFlag = true\n"))
	require.NoError(t, err)
	evaluator, err := featuremgmt.CreateStaticEvaluator(cfg)
	require.NoError(t, err)
	b := &APIBuilder{
		providerType:    setting.StaticProviderType,
		staticEvaluator: evaluator,
		logger:          log.NewNopLogger(),
	}

	t.Run("defined flag returns its value", func(t *testing.T) {
		w := httptest.NewRecorder()
		b.oneFlagHandler(w, newUnauthReq("/ofrep/v1/evaluate/flags/definedFlag", map[string]string{"flagKey": "definedFlag"}))

		require.Equal(t, http.StatusOK, w.Code)
		var got goffmodel.OFREPEvaluateSuccessResponse
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
		assert.Equal(t, true, got.Value)
	})

	t.Run("undefined flag returns FLAG_NOT_FOUND", func(t *testing.T) {
		w := httptest.NewRecorder()
		b.oneFlagHandler(w, newUnauthReq("/ofrep/v1/evaluate/flags/undefinedFlag", map[string]string{"flagKey": "undefinedFlag"}))

		require.Equal(t, http.StatusNotFound, w.Code)
		assert.Equal(t, "application/json", w.Header().Get("Content-Type"))
		var got goffmodel.OFREPEvaluateErrorResponse
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
		assert.Equal(t, "FLAG_NOT_FOUND", got.ErrorCode)
		assert.Equal(t, "undefinedFlag", got.Key)
	})
}
