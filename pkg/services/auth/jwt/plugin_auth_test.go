package jwt

import (
	"context"
	"strconv"
	"testing"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
	"gopkg.in/square/go-jose.v2/jwt"
)

func TestJWTGeneration(t *testing.T) {
	usr := &user.SignedInUser{UserID: 1, OrgID: 1, Login: "admin", Name: "Test User"}
	enableFeature := func(t *testing.T, cfg *setting.Cfg) {
		t.Helper()
		features = featuremgmt.WithFeatures(featuremgmt.FlagJwtTokenGeneration)
		t.Cleanup(func() {
			features = featuremgmt.WithFeatures()
		})
	}

	addValidKeyToConfig := func(t *testing.T, cfg *setting.Cfg) {
		t.Helper()
		cfg.JWTAuthSigningKey = `{"use":"sig","kty":"RSA","kid":"TpmgA3QOsm7O74Avm8IV_7z56PqL_dU0c-QYUA_V67k","alg":"RS512","n":"z1c48XhXtmDnmzAmApzfkORedY0_ml6f2AppiaNBd2l3zYkOFf814IKx0UYDbGrwEaXi76RmrxrXU3cNSbwGJKM1fFMu8SzPS0CNyqYMS-EbrVNxkN-RN5TlrNFIFfpVUx9i8NY3FrofzNPq9zhrldt_t4hNkDkHehwTI6Pj9gK5_8wtQN1tuoSgAwkDCUjpbG4r3C4LeOdlRRPVF35_N1xZq1HEO90ktepL2gdMXrL5bO1u1W7IFgqjbnS3lgIHh7-p2Xgw0aRHc_sQKUgITWK_GCqUzndwV7CG5WmVsWllyJR1ruwNotP-sAtbc81tDMK9u4xCX8j3qw8NkCxFDw","e":"AQAB","d":"xBf79PQaEJTptu38pO_0yTYS2B50juz7Q_nlApVybxtCgRMkTU2HiQRSZFhRGJKy5h372SWlL-q0x22LFbdMIA5zoVeSx-nXS5aMA6Kzcng-EtkeSSQIVYbvCVkNUivl0q2Wh6wxgb8aIEA0swebSKnFyrCQmtw05Bn1R_nSuXD65eWZd9DoaLFl8acFYISY90BLNXsyvhdIrobIvNHkQwInW_rvUlrfiUgzuqqT9iXF9qKMApLH0a-AA3onfDNLlZNjC4twa3sWj1bOP4XCdDR0-8mT6BTl7OjjDlU3lv5-1laVIoTAPPUQH-hkk8W0dRb6FNXnm3GK7nQNLVPMoQ","p":"5F8PMJ7ftlWLfkZkxXnQnDjlYf4BowIRc9Pm6DCRg4fOFjoFXK-fX9rhWCsLDiAZXZTPy4ETKIzlcenJeU3lcGxz-27D7YfAkxqTorkMi-Yk2ZxmCEV1YQXb3Zv55RJW1RTLHvgmXf2yQEbDSjPGCduFu4jH-1nKA27_Z6a2oVc","q":"6GzRtOr4gMte48mOk8j4mu7Rj7LYfTWLfySR9k_2ka8M1Cg1ayLDO9SVqiltzBC_Tx6M9itImyGHYwTnVYzJM6fCwvcKBer4dGDh4d5HOWLknMg5a1RcXPogQtw_lNDXaasMn1O_CqS8-mtk4LxY__j-wtucUdsHS6nSdMPHjwk","dp":"Dv2mc5yaNs_avklEqCnc5cReWlZgKSEjoCTSzX8Srj2l65OXcoQcxCAMFsuMiDrXL2trUIKCjXDiRt3_2bShUQXtfx3AQsFchMuD0XSwPCa5WIeJsxVMJThLPHrWppDTnl0lED1d12Gl5849V4uafl8ooizSY897EUqh_V3WMzU","dq":"BVoEFhtW73g_ThVlAAgfmUmob5uZmoByHtJTvg0nS0FxlSz71eSuBCGn9IwRqCI2lXbJnh1vBYtnF6OURAcC1vqk5GJVy78WS2-zo8S_dRXO18FQeSUvH0DvHzr9B8srOpaiqsR94JvcchOo9ffAQNyV2Ry_Y68cYuSdIO0lGik","qi":"Onqss8hvkRUrCdTZMPxPUKfdZrPMpmKBRF80nslGORGbVTabb-qwWbqJ6TTbhL0W31R7kYlgIYRS0EuGGHiGHWptHZsZ9VlOUd02ImF_m92tH35ao5HGUmH962FdjtGC6vhCLBw7PubNQ5_tRazhfvOgGytZXTNYfYV9hsG566E"}`
	}

	pluginScenario(t, "verifies a generated token when feature is enabled", func(t *testing.T, sc pluginScenarioContext) {
		token, err := sc.authJWTSvc.Generate(usr, "grafana-example-datasource")
		require.NoError(t, err)
		require.NotEmpty(t, token)
		claims, err := sc.authJWTSvc.Verify(sc.ctx, token)
		require.NoError(t, err)
		require.Equal(t, strconv.FormatInt(usr.UserID, 10), claims["sub"])
	}, enableFeature)

	pluginScenario(t, "verifies a generated token using the JWK from cfg", func(t *testing.T, sc pluginScenarioContext) {
		token, err := sc.authJWTSvc.Generate(usr, "grafana-example-datasource")
		require.NoError(t, err)
		require.NotEmpty(t, token)
		claims, err := sc.authJWTSvc.Verify(sc.ctx, token)
		require.NoError(t, err)
		require.Equal(t, strconv.FormatInt(usr.UserID, 10), claims["sub"])
	}, enableFeature, addValidKeyToConfig)

	pluginScenario(t, "rejects a token signed by another JWK", func(t *testing.T, sc pluginScenarioContext) {
		token := sign(t, &jwKeys[0], jwt.Claims{Subject: "1"})
		_, err := sc.authJWTSvc.Verify(sc.ctx, token)
		require.Error(t, err)
	}, enableFeature)

	pluginScenario(t, "rejects a generated token when feature is disabled", func(t *testing.T, sc pluginScenarioContext) {
		token, err := sc.authJWTSvc.Generate(usr, "grafana-example-datasource")
		require.Error(t, err)
		require.Empty(t, token)
		_, err = sc.authJWTSvc.Verify(sc.ctx, token)
		require.Error(t, err)
	})
}

func pluginScenario(t *testing.T, desc string, fn pluginScenarioFunc, cbs ...configureFunc) {
	t.Helper()
	t.Run(desc, pluginScenarioRunner(fn, cbs...))
}

func initPluginAuthService(t *testing.T, cbs ...configureFunc) (*pluginAuthService, error) {
	t.Helper()

	cfg := setting.NewCfg()
	cfg.JWTAuthEnabled = true
	cfg.JWTAuthExpectClaims = "{}"

	for _, cb := range cbs {
		cb(t, cfg)
	}

	service := newPluginAuthService(cfg, features)
	err := service.init()
	return service, err
}

type pluginScenarioFunc func(*testing.T, pluginScenarioContext)

type pluginScenarioContext struct {
	ctx        context.Context
	authJWTSvc *pluginAuthService
	cfg        *setting.Cfg
}

func pluginScenarioRunner(fn pluginScenarioFunc, cbs ...configureFunc) func(t *testing.T) {
	return func(t *testing.T) {
		authJWTSvc, err := initPluginAuthService(t, cbs...)
		require.NoError(t, err)

		fn(t, pluginScenarioContext{
			ctx:        context.Background(),
			cfg:        authJWTSvc.Cfg,
			authJWTSvc: authJWTSvc,
		})
	}
}
