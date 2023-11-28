import React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { Alert, Button, HorizontalGroup, LinkButton } from '@grafana/ui';
import { useCleanup } from 'app/core/hooks/useCleanup';
import { useDispatch } from 'app/types';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { updateAlertManagerConfigAction } from '../../state/actions';
import { globalConfigOptions } from '../../utils/cloud-alertmanager-notifier-types';
import { isVanillaPrometheusAlertManagerDataSource } from '../../utils/datasource';
import { makeAMLink } from '../../utils/misc';
import { omitEmptyValues } from '../../utils/receiver-form';
import { initialAsyncRequestState } from '../../utils/redux';
import { OptionField } from './form/fields/OptionField';
const defaultValues = {
    smtp_require_tls: true,
};
export const GlobalConfigForm = ({ config, alertManagerSourceName }) => {
    var _a;
    const dispatch = useDispatch();
    useCleanup((state) => (state.unifiedAlerting.saveAMConfig = initialAsyncRequestState));
    const { loading, error } = useUnifiedAlertingSelector((state) => state.saveAMConfig);
    const readOnly = isVanillaPrometheusAlertManagerDataSource(alertManagerSourceName);
    const formAPI = useForm({
        // making a copy here beacuse react-hook-form will mutate these, and break if the object is frozen. for real.
        defaultValues: JSON.parse(JSON.stringify(Object.assign(Object.assign({}, defaultValues), ((_a = config.alertmanager_config.global) !== null && _a !== void 0 ? _a : {})))),
    });
    const { handleSubmit, formState: { errors }, } = formAPI;
    const onSubmitCallback = (values) => {
        dispatch(updateAlertManagerConfigAction({
            newConfig: Object.assign(Object.assign({}, config), { alertmanager_config: Object.assign(Object.assign({}, config.alertmanager_config), { global: omitEmptyValues(values) }) }),
            oldConfig: config,
            alertManagerSourceName,
            successMessage: 'Global config updated.',
            redirectPath: makeAMLink('/alerting/notifications', alertManagerSourceName),
        }));
    };
    return (React.createElement(FormProvider, Object.assign({}, formAPI),
        React.createElement("form", { onSubmit: handleSubmit(onSubmitCallback) },
            error && (React.createElement(Alert, { severity: "error", title: "Error saving receiver" }, error.message || String(error))),
            globalConfigOptions.map((option) => (React.createElement(OptionField, { readOnly: readOnly, defaultValue: defaultValues[option.propertyName], key: option.propertyName, option: option, error: errors[option.propertyName], pathPrefix: '' }))),
            React.createElement("div", null,
                React.createElement(HorizontalGroup, null,
                    !readOnly && (React.createElement(React.Fragment, null,
                        loading && (React.createElement(Button, { disabled: true, icon: "fa fa-spinner", variant: "primary" }, "Saving...")),
                        !loading && React.createElement(Button, { type: "submit" }, "Save global config"))),
                    React.createElement(LinkButton, { disabled: loading, fill: "outline", variant: "secondary", href: makeAMLink('alerting/notifications', alertManagerSourceName) }, "Cancel"))))));
};
//# sourceMappingURL=GlobalConfigForm.js.map