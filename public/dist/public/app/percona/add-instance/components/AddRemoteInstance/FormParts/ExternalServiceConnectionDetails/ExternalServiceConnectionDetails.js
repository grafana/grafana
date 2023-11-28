import React, { useCallback, useEffect, useMemo } from 'react';
import { useStyles2 } from '@grafana/ui';
import { PasswordInputField } from 'app/percona/shared/components/Form/PasswordInput';
import { RadioButtonGroupField } from 'app/percona/shared/components/Form/RadioButtonGroup';
import { TextInputField } from 'app/percona/shared/components/Form/TextInput';
import Validators from 'app/percona/shared/helpers/validators';
import { validators } from 'app/percona/shared/helpers/validatorsForm';
import { metricsParametersOptions, schemaOptions } from '../FormParts.constants';
import { Messages } from '../FormParts.messages';
import { getStyles } from '../FormParts.styles';
import { MetricsParameters, Schema } from '../FormParts.types';
export const ExternalServiceConnectionDetails = ({ form }) => {
    const styles = useStyles2(getStyles);
    const formValues = form.getState().values;
    const selectedOption = formValues === null || formValues === void 0 ? void 0 : formValues.metricsParameters;
    const urlValue = formValues === null || formValues === void 0 ? void 0 : formValues.url;
    const portValidators = useMemo(() => [validators.required, Validators.validatePort], []);
    const trim = useCallback((value) => (value ? value.trim() : value), []);
    const getUrlParts = () => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        try {
            const url = new URL(form.getState().values.url);
            const protocol = url.protocol.replace(':', '');
            (_a = form.mutators) === null || _a === void 0 ? void 0 : _a.setValue('schema', protocol);
            (_b = form.mutators) === null || _b === void 0 ? void 0 : _b.setValue('address', url.hostname);
            (_c = form.mutators) === null || _c === void 0 ? void 0 : _c.setValue('port', url.port || (protocol === 'https' ? '443' : '80'));
            (_d = form.mutators) === null || _d === void 0 ? void 0 : _d.setValue('metrics_path', url.pathname);
            (_e = form.mutators) === null || _e === void 0 ? void 0 : _e.setValue('username', url.username);
            (_f = form.mutators) === null || _f === void 0 ? void 0 : _f.setValue('password', url.password);
        }
        catch (e) {
            (_g = form.mutators) === null || _g === void 0 ? void 0 : _g.setValue('schema', Schema.HTTPS);
            (_h = form.mutators) === null || _h === void 0 ? void 0 : _h.setValue('address', '');
            (_j = form.mutators) === null || _j === void 0 ? void 0 : _j.setValue('port', '443');
            (_k = form.mutators) === null || _k === void 0 ? void 0 : _k.setValue('metrics_path', '');
            (_l = form.mutators) === null || _l === void 0 ? void 0 : _l.setValue('username', '');
            (_m = form.mutators) === null || _m === void 0 ? void 0 : _m.setValue('password', '');
        }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(getUrlParts, [urlValue]);
    return (React.createElement("div", { className: styles.groupWrapper },
        React.createElement("h4", { className: styles.sectionHeader }, Messages.form.titles.connectionDetails),
        React.createElement("div", { className: styles.group },
            React.createElement(TextInputField, { name: "serviceName", label: Messages.form.labels.externalService.serviceName, tooltipText: Messages.form.tooltips.externalService.serviceName, placeholder: Messages.form.placeholders.externalService.serviceName }),
            React.createElement("div", null)),
        React.createElement("div", { className: styles.group },
            React.createElement(TextInputField, { name: "group", label: Messages.form.labels.externalService.group, tooltipText: Messages.form.tooltips.externalService.group }),
            React.createElement("div", null)),
        React.createElement("div", { className: styles.group },
            React.createElement(RadioButtonGroupField, { name: "metricsParameters", "data-testid": "metrics-parameters-field", label: Messages.form.labels.externalService.connectionParameters, tooltipText: Messages.form.tooltips.externalService.url, options: metricsParametersOptions })),
        selectedOption === MetricsParameters.parsed && (React.createElement("div", { className: styles.urlFieldWrapper },
            React.createElement(TextInputField, { name: "url", label: Messages.form.labels.externalService.url, tooltipText: Messages.form.tooltips.externalService.url, placeholder: Messages.form.placeholders.externalService.url, validators: [Validators.validateUrl, validators.required] }))),
        selectedOption === MetricsParameters.manually && (React.createElement(React.Fragment, null,
            React.createElement("div", { className: styles.group },
                React.createElement(RadioButtonGroupField, { name: "schema", "data-testid": "http-schema-field", label: Messages.form.labels.externalService.schema, tooltipText: Messages.form.tooltips.externalService.schema, options: schemaOptions }),
                React.createElement("div", null)),
            React.createElement("div", { className: styles.group },
                React.createElement(TextInputField, { name: "address", initialValue: "", label: Messages.form.labels.externalService.address, tooltipText: Messages.form.tooltips.externalService.address, placeholder: Messages.form.placeholders.externalService.address, validators: [validators.required] }),
                React.createElement(TextInputField, { name: "metrics_path", initialValue: "", label: Messages.form.labels.externalService.metricsPath, tooltipText: Messages.form.tooltips.externalService.metricsPath, placeholder: Messages.form.placeholders.externalService.metricsPath })),
            React.createElement("div", { className: styles.group },
                React.createElement(TextInputField, { name: "port", placeholder: "Port", label: Messages.form.labels.externalService.port, tooltipText: Messages.form.tooltips.externalService.port, validators: portValidators }),
                React.createElement("div", null)),
            React.createElement("div", { className: styles.group },
                React.createElement(TextInputField, { name: "username", initialValue: "", label: Messages.form.labels.externalService.username, tooltipText: Messages.form.tooltips.externalService.username, placeholder: Messages.form.placeholders.externalService.username, format: trim }),
                React.createElement(PasswordInputField, { name: "password", initialValue: "", label: Messages.form.labels.externalService.password, tooltipText: Messages.form.tooltips.externalService.password, placeholder: Messages.form.placeholders.externalService.password, format: trim }))))));
};
//# sourceMappingURL=ExternalServiceConnectionDetails.js.map