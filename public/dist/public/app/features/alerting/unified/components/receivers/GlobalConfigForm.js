import { __assign, __makeTemplateObject } from "tslib";
import { useCleanup } from 'app/core/hooks/useCleanup';
import React from 'react';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { useForm, FormProvider } from 'react-hook-form';
import { globalConfigOptions } from '../../utils/cloud-alertmanager-notifier-types';
import { OptionField } from './form/fields/OptionField';
import { Alert, Button, HorizontalGroup, LinkButton, useStyles2 } from '@grafana/ui';
import { makeAMLink } from '../../utils/misc';
import { useDispatch } from 'react-redux';
import { updateAlertManagerConfigAction } from '../../state/actions';
import { omitEmptyValues } from '../../utils/receiver-form';
import { css } from '@emotion/css';
import { isVanillaPrometheusAlertManagerDataSource } from '../../utils/datasource';
var defaultValues = {
    smtp_require_tls: true,
};
export var GlobalConfigForm = function (_a) {
    var _b;
    var config = _a.config, alertManagerSourceName = _a.alertManagerSourceName;
    var dispatch = useDispatch();
    useCleanup(function (state) { return state.unifiedAlerting.saveAMConfig; });
    var _c = useUnifiedAlertingSelector(function (state) { return state.saveAMConfig; }), loading = _c.loading, error = _c.error;
    var readOnly = isVanillaPrometheusAlertManagerDataSource(alertManagerSourceName);
    var styles = useStyles2(getStyles);
    var formAPI = useForm({
        // making a copy here beacuse react-hook-form will mutate these, and break if the object is frozen. for real.
        defaultValues: JSON.parse(JSON.stringify(__assign(__assign({}, defaultValues), ((_b = config.alertmanager_config.global) !== null && _b !== void 0 ? _b : {})))),
    });
    var handleSubmit = formAPI.handleSubmit, errors = formAPI.formState.errors;
    var onSubmitCallback = function (values) {
        dispatch(updateAlertManagerConfigAction({
            newConfig: __assign(__assign({}, config), { alertmanager_config: __assign(__assign({}, config.alertmanager_config), { global: omitEmptyValues(values) }) }),
            oldConfig: config,
            alertManagerSourceName: alertManagerSourceName,
            successMessage: 'Global config updated.',
            redirectPath: makeAMLink('/alerting/notifications', alertManagerSourceName),
        }));
    };
    return (React.createElement(FormProvider, __assign({}, formAPI),
        React.createElement("form", { onSubmit: handleSubmit(onSubmitCallback) },
            React.createElement("h4", { className: styles.heading }, "Global config"),
            error && (React.createElement(Alert, { severity: "error", title: "Error saving receiver" }, error.message || String(error))),
            globalConfigOptions.map(function (option) { return (React.createElement(OptionField, { readOnly: readOnly, defaultValue: defaultValues[option.propertyName], key: option.propertyName, option: option, error: errors[option.propertyName], pathPrefix: '' })); }),
            React.createElement("div", null,
                React.createElement(HorizontalGroup, null,
                    !readOnly && (React.createElement(React.Fragment, null,
                        loading && (React.createElement(Button, { disabled: true, icon: "fa fa-spinner", variant: "primary" }, "Saving...")),
                        !loading && React.createElement(Button, { type: "submit" }, "Save global config"))),
                    React.createElement(LinkButton, { disabled: loading, fill: "outline", variant: "secondary", href: makeAMLink('alerting/notifications', alertManagerSourceName) }, "Cancel"))))));
};
var getStyles = function (theme) { return ({
    heading: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin: ", ";\n  "], ["\n    margin: ", ";\n  "])), theme.spacing(4, 0)),
}); };
var templateObject_1;
//# sourceMappingURL=GlobalConfigForm.js.map