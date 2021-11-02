import { __assign, __makeTemplateObject, __read } from "tslib";
import React, { useEffect, useState, useMemo } from 'react';
import { css } from '@emotion/css';
import { Alert, Button, ConfirmModal, TextArea, HorizontalGroup, Field, Form, useStyles2 } from '@grafana/ui';
import { useAlertManagerSourceName } from '../../hooks/useAlertManagerSourceName';
import { AlertManagerPicker } from '../AlertManagerPicker';
import { GRAFANA_RULES_SOURCE_NAME, isVanillaPrometheusAlertManagerDataSource } from '../../utils/datasource';
import { useDispatch } from 'react-redux';
import { deleteAlertManagerConfigAction, fetchAlertManagerConfigAction, updateAlertManagerConfigAction, } from '../../state/actions';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { initialAsyncRequestState } from '../../utils/redux';
export default function AlertmanagerConfig() {
    var dispatch = useDispatch();
    var _a = __read(useAlertManagerSourceName(), 2), alertManagerSourceName = _a[0], setAlertManagerSourceName = _a[1];
    var _b = __read(useState(false), 2), showConfirmDeleteAMConfig = _b[0], setShowConfirmDeleteAMConfig = _b[1];
    var isDeleting = useUnifiedAlertingSelector(function (state) { return state.deleteAMConfig; }).loading;
    var isSaving = useUnifiedAlertingSelector(function (state) { return state.saveAMConfig; }).loading;
    var readOnly = alertManagerSourceName ? isVanillaPrometheusAlertManagerDataSource(alertManagerSourceName) : false;
    var styles = useStyles2(getStyles);
    var configRequests = useUnifiedAlertingSelector(function (state) { return state.amConfigs; });
    var _c = (alertManagerSourceName && configRequests[alertManagerSourceName]) || initialAsyncRequestState, config = _c.result, isLoadingConfig = _c.loading, loadingError = _c.error;
    useEffect(function () {
        if (alertManagerSourceName) {
            dispatch(fetchAlertManagerConfigAction(alertManagerSourceName));
        }
    }, [alertManagerSourceName, dispatch]);
    var resetConfig = function () {
        if (alertManagerSourceName) {
            dispatch(deleteAlertManagerConfigAction(alertManagerSourceName));
        }
        setShowConfirmDeleteAMConfig(false);
    };
    var defaultValues = useMemo(function () { return ({
        configJSON: config ? JSON.stringify(config, null, 2) : '',
    }); }, [config]);
    var loading = isDeleting || isLoadingConfig || isSaving;
    var onSubmit = function (values) {
        if (alertManagerSourceName) {
            dispatch(updateAlertManagerConfigAction({
                newConfig: JSON.parse(values.configJSON),
                oldConfig: config,
                alertManagerSourceName: alertManagerSourceName,
                successMessage: 'Alertmanager configuration updated.',
                refetch: true,
            }));
        }
    };
    return (React.createElement("div", { className: styles.container },
        React.createElement(AlertManagerPicker, { current: alertManagerSourceName, onChange: setAlertManagerSourceName }),
        loadingError && !loading && (React.createElement(Alert, { severity: "error", title: "Error loading Alertmanager configuration" }, loadingError.message || 'Unknown error.')),
        isDeleting && alertManagerSourceName !== GRAFANA_RULES_SOURCE_NAME && (React.createElement(Alert, { severity: "info", title: "Resetting Alertmanager configuration" }, "It might take a while...")),
        alertManagerSourceName && config && (React.createElement(Form, { defaultValues: defaultValues, onSubmit: onSubmit, key: defaultValues.configJSON }, function (_a) {
            var _b;
            var register = _a.register, errors = _a.errors;
            return (React.createElement(React.Fragment, null,
                !readOnly && (React.createElement(Field, { disabled: loading, label: "Configuration", invalid: !!errors.configJSON, error: (_b = errors.configJSON) === null || _b === void 0 ? void 0 : _b.message },
                    React.createElement(TextArea, __assign({}, register('configJSON', {
                        required: { value: true, message: 'Required.' },
                        validate: function (v) {
                            try {
                                JSON.parse(v);
                                return true;
                            }
                            catch (e) {
                                return e.message;
                            }
                        },
                    }), { id: "configuration", rows: 25 })))),
                readOnly && (React.createElement(Field, { label: "Configuration" },
                    React.createElement("pre", { "data-testid": "readonly-config" }, defaultValues.configJSON))),
                !readOnly && (React.createElement(HorizontalGroup, null,
                    React.createElement(Button, { type: "submit", variant: "primary", disabled: loading }, "Save"),
                    React.createElement(Button, { type: "button", disabled: loading, variant: "destructive", onClick: function () { return setShowConfirmDeleteAMConfig(true); } }, "Reset configuration"))),
                !!showConfirmDeleteAMConfig && (React.createElement(ConfirmModal, { isOpen: true, title: "Reset Alertmanager configuration", body: "Are you sure you want to reset configuration " + (alertManagerSourceName === GRAFANA_RULES_SOURCE_NAME
                        ? 'for the Grafana Alertmanager'
                        : "for \"" + alertManagerSourceName + "\"") + "? Contact points and notification policies will be reset to their defaults.", confirmText: "Yes, reset configuration", onConfirm: resetConfig, onDismiss: function () { return setShowConfirmDeleteAMConfig(false); } }))));
        }))));
}
var getStyles = function (theme) { return ({
    container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin-bottom: ", ";\n  "], ["\n    margin-bottom: ", ";\n  "])), theme.spacing(4)),
}); };
var templateObject_1;
//# sourceMappingURL=AlertmanagerConfig.js.map