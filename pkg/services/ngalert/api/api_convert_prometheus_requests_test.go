package api

import (
	"errors"
	"net/http"
	"testing"

	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/merge"
)

func TestConvertRequestsMetric(t *testing.T) {
	group := apimodels.PrometheusRuleGroup{
		Name:  "g",
		Rules: []apimodels.PrometheusRule{{Alert: "A", Expr: "up == 0"}},
	}
	amCfg := apimodels.AlertmanagerUserConfig{AlertmanagerConfig: "route: {receiver: default}\nreceivers:\n  - name: default"}

	newSrv := func(t *testing.T, am *mockAlertmanager) *ConvertPrometheusSrv {
		t.Helper()
		ft := featuremgmt.WithFeatures(featuremgmt.FlagAlertingImportAlertmanagerAPI)
		srv, _, _ := createConvertPrometheusSrv(t, withAlertmanager(am), withFeatureToggles(ft))
		return srv
	}
	newAM := func() *mockAlertmanager {
		am := &mockAlertmanager{}
		am.On("IsExternalAMSyncConfiguredForOrg", mock.Anything, int64(1)).Return(false, nil).Maybe()
		return am
	}
	count := func(srv *ConvertPrometheusSrv, operation, source, result string) float64 {
		return testutil.ToFloat64(srv.requests.WithLabelValues(operation, source, result))
	}
	total := func(srv *ConvertPrometheusSrv) int {
		return testutil.CollectAndCount(srv.requests)
	}

	t.Run("source comes from the header and unknown values fall back to other", func(t *testing.T) {
		for _, tc := range []struct {
			name, header, want string
		}{
			{name: "header absent", want: importSourceOther},
			{name: "wizard", header: "wizard", want: importSourceWizard},
			{name: "import settings", header: "import_settings", want: importSourceImportSettings},
			{name: "unknown value", header: "mimirtool", want: importSourceOther},
			{name: "value is case sensitive", header: "Wizard", want: importSourceOther},
		} {
			t.Run(tc.name, func(t *testing.T) {
				srv := newSrv(t, newAM())
				rc := createRequestCtx()
				if tc.header != "" {
					rc.Req.Header.Set(importSourceHeader, tc.header)
				}

				resp := srv.RouteConvertPrometheusPostRuleGroups(rc, map[string][]apimodels.PrometheusRuleGroup{"ns": {group}})

				require.Equal(t, http.StatusAccepted, resp.Status())
				require.Equal(t, 1.0, count(srv, operationPostRules, tc.want, resultAccepted))
				require.Equal(t, 1, total(srv), "no other label set is created")
			})
		}
	})

	t.Run("single group route counts once", func(t *testing.T) {
		srv := newSrv(t, newAM())

		resp := srv.RouteConvertPrometheusPostRuleGroup(createRequestCtx(), "ns", group)

		require.Equal(t, http.StatusAccepted, resp.Status())
		require.Equal(t, 1.0, count(srv, operationPostRules, importSourceOther, resultAccepted))
		require.Equal(t, 1, total(srv))
	})

	t.Run("failed rule import counts as failed", func(t *testing.T) {
		srv := newSrv(t, newAM())
		rc := createRequestCtx()
		rc.Req.Header.Set(alertRulesPausedHeader, "not-a-bool")

		resp := srv.RouteConvertPrometheusPostRuleGroups(rc, map[string][]apimodels.PrometheusRuleGroup{"ns": {group}})

		require.Equal(t, http.StatusBadRequest, resp.Status())
		require.Equal(t, 1.0, count(srv, operationPostRules, importSourceOther, resultFailed))
		require.Equal(t, 1, total(srv))
	})

	t.Run("rule deletes are counted", func(t *testing.T) {
		srv := newSrv(t, newAM())

		srv.RouteConvertPrometheusDeleteNamespace(createRequestCtx(), "missing")
		srv.RouteConvertPrometheusDeleteRuleGroup(createRequestCtx(), "missing", "g")

		require.Equal(t, 2.0, count(srv, operationDeleteRules, importSourceOther, resultFailed))
	})

	t.Run("alertmanager post", func(t *testing.T) {
		am := newAM()
		srv := newSrv(t, am)
		am.On("SaveAndApplyExtraConfiguration", mock.Anything, int64(1), mock.Anything, mock.Anything, mock.Anything, false, false, false).Return(merge.MergeResult{}, nil).Once()
		rc := createRequestCtx()
		rc.Req.Header.Set(configIdentifierHeader, "cfg")
		rc.Req.Header.Set(importSourceHeader, "wizard")

		resp := srv.RouteConvertPrometheusPostAlertmanagerConfig(rc, amCfg)

		require.Equal(t, http.StatusAccepted, resp.Status())
		require.Equal(t, 1.0, count(srv, operationPostAlertmanager, importSourceWizard, resultAccepted))
	})

	t.Run("alertmanager dry runs are not counted, whether they pass or fail", func(t *testing.T) {
		am := newAM()
		srv := newSrv(t, am)
		am.On("SaveAndApplyExtraConfiguration", mock.Anything, int64(1), mock.Anything, mock.Anything, mock.Anything, false, true, false).Return(merge.MergeResult{}, nil).Once()
		am.On("SaveAndApplyExtraConfiguration", mock.Anything, int64(1), mock.Anything, mock.Anything, mock.Anything, false, true, false).Return(merge.MergeResult{}, errors.New("invalid")).Once()

		for range 2 {
			rc := createRequestCtx()
			rc.Req.Header.Set(configIdentifierHeader, "cfg")
			rc.Req.Header.Set(dryRunHeader, "true")
			srv.RouteConvertPrometheusPostAlertmanagerConfig(rc, amCfg)
		}

		require.Equal(t, 0, total(srv))
	})

	t.Run("alertmanager dry run false is counted", func(t *testing.T) {
		am := newAM()
		srv := newSrv(t, am)
		am.On("SaveAndApplyExtraConfiguration", mock.Anything, int64(1), mock.Anything, mock.Anything, mock.Anything, false, false, false).Return(merge.MergeResult{}, nil).Once()
		rc := createRequestCtx()
		rc.Req.Header.Set(configIdentifierHeader, "cfg")
		rc.Req.Header.Set(dryRunHeader, "false")

		srv.RouteConvertPrometheusPostAlertmanagerConfig(rc, amCfg)

		require.Equal(t, 1.0, count(srv, operationPostAlertmanager, importSourceOther, resultAccepted))
	})

	t.Run("alertmanager post rejected while sync is configured counts as failed", func(t *testing.T) {
		am := &mockAlertmanager{}
		am.On("IsExternalAMSyncConfiguredForOrg", mock.Anything, int64(1)).Return(true, nil)
		srv := newSrv(t, am)

		resp := srv.RouteConvertPrometheusPostAlertmanagerConfig(createRequestCtx(), amCfg)

		require.Equal(t, http.StatusConflict, resp.Status())
		require.Equal(t, 1.0, count(srv, operationPostAlertmanager, importSourceOther, resultFailed))
	})

	t.Run("alertmanager promote and delete", func(t *testing.T) {
		am := newAM()
		srv := newSrv(t, am)
		am.On("PromoteExtraConfiguration", mock.Anything, int64(1), mock.Anything, mock.Anything, "cfg").Return(merge.MergeResult{}, nil).Once()
		am.On("PromoteExtraConfiguration", mock.Anything, int64(1), mock.Anything, mock.Anything, "bad").Return(merge.MergeResult{}, errors.New("boom")).Once()
		am.On("DeleteExtraConfiguration", mock.Anything, int64(1), mock.Anything, mock.Anything, "cfg").Return(nil).Once()
		rc := createRequestCtx()
		rc.Req.Header.Set(importSourceHeader, "import_settings")
		rc.Req.Header.Set(configIdentifierHeader, "cfg")

		srv.RouteConvertPrometheusPromoteAlertmanagerConfig(rc, "cfg")
		srv.RouteConvertPrometheusPromoteAlertmanagerConfig(rc, "bad")
		srv.RouteConvertPrometheusDeleteAlertmanagerConfig(rc)

		require.Equal(t, 1.0, count(srv, operationPromoteAlertmanager, importSourceImportSettings, resultAccepted))
		require.Equal(t, 1.0, count(srv, operationPromoteAlertmanager, importSourceImportSettings, resultFailed))
		require.Equal(t, 1.0, count(srv, operationDeleteAlertmanager, importSourceImportSettings, resultAccepted))
	})
}
