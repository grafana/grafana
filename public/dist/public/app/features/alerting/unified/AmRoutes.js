import { __assign, __makeTemplateObject, __read } from "tslib";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { css } from '@emotion/css';
import { Alert, LoadingPlaceholder, useStyles2, withErrorBoundary } from '@grafana/ui';
import { useDispatch } from 'react-redux';
import { Redirect } from 'react-router-dom';
import { useCleanup } from '../../../core/hooks/useCleanup';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { AlertManagerPicker } from './components/AlertManagerPicker';
import { AmRootRoute } from './components/amroutes/AmRootRoute';
import { AmSpecificRouting } from './components/amroutes/AmSpecificRouting';
import { useAlertManagerSourceName } from './hooks/useAlertManagerSourceName';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { fetchAlertManagerConfigAction, updateAlertManagerConfigAction } from './state/actions';
import { amRouteToFormAmRoute, formAmRouteToAmRoute, stringsToSelectableValues } from './utils/amroutes';
import { initialAsyncRequestState } from './utils/redux';
import { isVanillaPrometheusAlertManagerDataSource } from './utils/datasource';
var AmRoutes = function () {
    var _a;
    var dispatch = useDispatch();
    var styles = useStyles2(getStyles);
    var _b = __read(useState(false), 2), isRootRouteEditMode = _b[0], setIsRootRouteEditMode = _b[1];
    var _c = __read(useAlertManagerSourceName(), 2), alertManagerSourceName = _c[0], setAlertManagerSourceName = _c[1];
    var readOnly = alertManagerSourceName ? isVanillaPrometheusAlertManagerDataSource(alertManagerSourceName) : true;
    var amConfigs = useUnifiedAlertingSelector(function (state) { return state.amConfigs; });
    var fetchConfig = useCallback(function () {
        if (alertManagerSourceName) {
            dispatch(fetchAlertManagerConfigAction(alertManagerSourceName));
        }
    }, [alertManagerSourceName, dispatch]);
    useEffect(function () {
        fetchConfig();
    }, [fetchConfig]);
    var _d = (alertManagerSourceName && amConfigs[alertManagerSourceName]) || initialAsyncRequestState, result = _d.result, resultLoading = _d.loading, resultError = _d.error;
    var config = result === null || result === void 0 ? void 0 : result.alertmanager_config;
    var _e = __read(useMemo(function () { return amRouteToFormAmRoute(config === null || config === void 0 ? void 0 : config.route); }, [config === null || config === void 0 ? void 0 : config.route]), 2), rootRoute = _e[0], id2ExistingRoute = _e[1];
    var receivers = stringsToSelectableValues(((_a = config === null || config === void 0 ? void 0 : config.receivers) !== null && _a !== void 0 ? _a : []).map(function (receiver) { return receiver.name; }));
    var enterRootRouteEditMode = function () {
        setIsRootRouteEditMode(true);
    };
    var exitRootRouteEditMode = function () {
        setIsRootRouteEditMode(false);
    };
    useCleanup(function (state) { return state.unifiedAlerting.saveAMConfig; });
    var handleSave = function (data) {
        var newData = formAmRouteToAmRoute(alertManagerSourceName, __assign(__assign({}, rootRoute), data), id2ExistingRoute);
        if (isRootRouteEditMode) {
            exitRootRouteEditMode();
        }
        dispatch(updateAlertManagerConfigAction({
            newConfig: __assign(__assign({}, result), { alertmanager_config: __assign(__assign({}, result.alertmanager_config), { route: newData }) }),
            oldConfig: result,
            alertManagerSourceName: alertManagerSourceName,
            successMessage: 'Saved',
            refetch: true,
        }));
    };
    if (!alertManagerSourceName) {
        return React.createElement(Redirect, { to: "/alerting/routes" });
    }
    return (React.createElement(AlertingPageWrapper, { pageId: "am-routes" },
        React.createElement(AlertManagerPicker, { current: alertManagerSourceName, onChange: setAlertManagerSourceName }),
        resultError && !resultLoading && (React.createElement(Alert, { severity: "error", title: "Error loading Alertmanager config" }, resultError.message || 'Unknown error.')),
        resultLoading && React.createElement(LoadingPlaceholder, { text: "Loading Alertmanager config..." }),
        result && !resultLoading && !resultError && (React.createElement(React.Fragment, null,
            React.createElement(AmRootRoute, { alertManagerSourceName: alertManagerSourceName, isEditMode: isRootRouteEditMode, onSave: handleSave, onEnterEditMode: enterRootRouteEditMode, onExitEditMode: exitRootRouteEditMode, receivers: receivers, routes: rootRoute }),
            React.createElement("div", { className: styles.break }),
            React.createElement(AmSpecificRouting, { onChange: handleSave, readOnly: readOnly, onRootRouteEdit: enterRootRouteEditMode, receivers: receivers, routes: rootRoute })))));
};
export default withErrorBoundary(AmRoutes, { style: 'page' });
var getStyles = function (theme) { return ({
    break: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    width: 100%;\n    height: 0;\n    margin-bottom: ", ";\n  "], ["\n    width: 100%;\n    height: 0;\n    margin-bottom: ", ";\n  "])), theme.spacing(2)),
}); };
var templateObject_1;
//# sourceMappingURL=AmRoutes.js.map