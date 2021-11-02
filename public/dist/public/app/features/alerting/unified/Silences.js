import { __read } from "tslib";
import React, { useEffect, useCallback } from 'react';
import { Alert, LoadingPlaceholder, withErrorBoundary } from '@grafana/ui';
import { useDispatch } from 'react-redux';
import { Redirect, Route, Switch, useLocation } from 'react-router-dom';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import SilencesTable from './components/silences/SilencesTable';
import { useAlertManagerSourceName } from './hooks/useAlertManagerSourceName';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { fetchAmAlertsAction, fetchSilencesAction } from './state/actions';
import { SILENCES_POLL_INTERVAL_MS } from './utils/constants';
import { initialAsyncRequestState } from './utils/redux';
import SilencesEditor from './components/silences/SilencesEditor';
import { AlertManagerPicker } from './components/AlertManagerPicker';
var Silences = function () {
    var _a, _b;
    var _c = __read(useAlertManagerSourceName(), 2), alertManagerSourceName = _c[0], setAlertManagerSourceName = _c[1];
    var dispatch = useDispatch();
    var silences = useUnifiedAlertingSelector(function (state) { return state.silences; });
    var alertsRequests = useUnifiedAlertingSelector(function (state) { return state.amAlerts; });
    var alertsRequest = alertManagerSourceName
        ? alertsRequests[alertManagerSourceName] || initialAsyncRequestState
        : undefined;
    var location = useLocation();
    var isRoot = location.pathname.endsWith('/alerting/silences');
    useEffect(function () {
        function fetchAll() {
            if (alertManagerSourceName) {
                dispatch(fetchSilencesAction(alertManagerSourceName));
                dispatch(fetchAmAlertsAction(alertManagerSourceName));
            }
        }
        fetchAll();
        var interval = setInterval(function () { return fetchAll; }, SILENCES_POLL_INTERVAL_MS);
        return function () {
            clearInterval(interval);
        };
    }, [alertManagerSourceName, dispatch]);
    var _d = (alertManagerSourceName && silences[alertManagerSourceName]) || initialAsyncRequestState, result = _d.result, loading = _d.loading, error = _d.error;
    var getSilenceById = useCallback(function (id) { return result && result.find(function (silence) { return silence.id === id; }); }, [result]);
    if (!alertManagerSourceName) {
        return React.createElement(Redirect, { to: "/alerting/silences" });
    }
    return (React.createElement(AlertingPageWrapper, { pageId: "silences" },
        React.createElement(AlertManagerPicker, { disabled: !isRoot, current: alertManagerSourceName, onChange: setAlertManagerSourceName }),
        error && !loading && (React.createElement(Alert, { severity: "error", title: "Error loading silences" }, error.message || 'Unknown error.')),
        (alertsRequest === null || alertsRequest === void 0 ? void 0 : alertsRequest.error) && !(alertsRequest === null || alertsRequest === void 0 ? void 0 : alertsRequest.loading) && (React.createElement(Alert, { severity: "error", title: "Error loading Alertmanager alerts" }, ((_a = alertsRequest.error) === null || _a === void 0 ? void 0 : _a.message) || 'Unknown error.')),
        loading && React.createElement(LoadingPlaceholder, { text: "loading silences..." }),
        result && !error && (React.createElement(Switch, null,
            React.createElement(Route, { exact: true, path: "/alerting/silences" },
                React.createElement(SilencesTable, { silences: result, alertManagerAlerts: (_b = alertsRequest === null || alertsRequest === void 0 ? void 0 : alertsRequest.result) !== null && _b !== void 0 ? _b : [], alertManagerSourceName: alertManagerSourceName })),
            React.createElement(Route, { exact: true, path: "/alerting/silence/new" },
                React.createElement(SilencesEditor, { alertManagerSourceName: alertManagerSourceName })),
            React.createElement(Route, { exact: true, path: "/alerting/silence/:id/edit" }, function (_a) {
                var match = _a.match;
                return ((match === null || match === void 0 ? void 0 : match.params.id) && (React.createElement(SilencesEditor, { silence: getSilenceById(match.params.id), alertManagerSourceName: alertManagerSourceName })));
            })))));
};
export default withErrorBoundary(Silences, { style: 'page' });
//# sourceMappingURL=Silences.js.map