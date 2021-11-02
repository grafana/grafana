import { __read } from "tslib";
import { Alert, LoadingPlaceholder, withErrorBoundary } from '@grafana/ui';
import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Redirect, Route, Switch, useLocation } from 'react-router-dom';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { AlertManagerPicker } from './components/AlertManagerPicker';
import { EditReceiverView } from './components/receivers/EditReceiverView';
import { EditTemplateView } from './components/receivers/EditTemplateView';
import { GlobalConfigForm } from './components/receivers/GlobalConfigForm';
import { NewReceiverView } from './components/receivers/NewReceiverView';
import { NewTemplateView } from './components/receivers/NewTemplateView';
import { ReceiversAndTemplatesView } from './components/receivers/ReceiversAndTemplatesView';
import { useAlertManagerSourceName } from './hooks/useAlertManagerSourceName';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { fetchAlertManagerConfigAction, fetchGrafanaNotifiersAction } from './state/actions';
import { GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';
import { initialAsyncRequestState } from './utils/redux';
var Receivers = function () {
    var _a = __read(useAlertManagerSourceName(), 2), alertManagerSourceName = _a[0], setAlertManagerSourceName = _a[1];
    var dispatch = useDispatch();
    var location = useLocation();
    var isRoot = location.pathname.endsWith('/alerting/notifications');
    var configRequests = useUnifiedAlertingSelector(function (state) { return state.amConfigs; });
    var _b = (alertManagerSourceName && configRequests[alertManagerSourceName]) || initialAsyncRequestState, config = _b.result, loading = _b.loading, error = _b.error;
    var receiverTypes = useUnifiedAlertingSelector(function (state) { return state.grafanaNotifiers; });
    var shouldLoadConfig = isRoot || !config;
    useEffect(function () {
        if (alertManagerSourceName && shouldLoadConfig) {
            dispatch(fetchAlertManagerConfigAction(alertManagerSourceName));
        }
    }, [alertManagerSourceName, dispatch, shouldLoadConfig]);
    useEffect(function () {
        if (alertManagerSourceName === GRAFANA_RULES_SOURCE_NAME && !(receiverTypes.result || receiverTypes.loading)) {
            dispatch(fetchGrafanaNotifiersAction());
        }
    }, [alertManagerSourceName, dispatch, receiverTypes]);
    var disableAmSelect = !isRoot;
    if (!alertManagerSourceName) {
        return React.createElement(Redirect, { to: "/alerting/notifications" });
    }
    return (React.createElement(AlertingPageWrapper, { pageId: "receivers" },
        React.createElement(AlertManagerPicker, { current: alertManagerSourceName, disabled: disableAmSelect, onChange: setAlertManagerSourceName }),
        error && !loading && (React.createElement(Alert, { severity: "error", title: "Error loading Alertmanager config" }, error.message || 'Unknown error.')),
        loading && !config && React.createElement(LoadingPlaceholder, { text: "loading configuration..." }),
        config && !error && (React.createElement(Switch, null,
            React.createElement(Route, { exact: true, path: "/alerting/notifications" },
                React.createElement(ReceiversAndTemplatesView, { config: config, alertManagerName: alertManagerSourceName })),
            React.createElement(Route, { exact: true, path: "/alerting/notifications/templates/new" },
                React.createElement(NewTemplateView, { config: config, alertManagerSourceName: alertManagerSourceName })),
            React.createElement(Route, { exact: true, path: "/alerting/notifications/templates/:name/edit" }, function (_a) {
                var match = _a.match;
                return (match === null || match === void 0 ? void 0 : match.params.name) && (React.createElement(EditTemplateView, { alertManagerSourceName: alertManagerSourceName, config: config, templateName: decodeURIComponent(match === null || match === void 0 ? void 0 : match.params.name) }));
            }),
            React.createElement(Route, { exact: true, path: "/alerting/notifications/receivers/new" },
                React.createElement(NewReceiverView, { config: config, alertManagerSourceName: alertManagerSourceName })),
            React.createElement(Route, { exact: true, path: "/alerting/notifications/receivers/:name/edit" }, function (_a) {
                var match = _a.match;
                return (match === null || match === void 0 ? void 0 : match.params.name) && (React.createElement(EditReceiverView, { alertManagerSourceName: alertManagerSourceName, config: config, receiverName: decodeURIComponent(match === null || match === void 0 ? void 0 : match.params.name) }));
            }),
            React.createElement(Route, { exact: true, path: "/alerting/notifications/global-config" },
                React.createElement(GlobalConfigForm, { config: config, alertManagerSourceName: alertManagerSourceName }))))));
};
export default withErrorBoundary(Receivers, { style: 'page' });
//# sourceMappingURL=Receivers.js.map