import React from 'react';
import { DataSourceHttpSettings, EventsWithValidation, LegacyForms, regexValidation } from '@grafana/ui';
import { config } from 'app/core/config';
export const ConfigEditor = (props) => {
    const { options, onOptionsChange } = props;
    return (React.createElement(React.Fragment, null,
        React.createElement(DataSourceHttpSettings, { defaultUrl: 'http://localhost:4040', dataSourceConfig: options, showAccessOptions: false, onChange: onOptionsChange, secureSocksDSProxyEnabled: config.secureSocksDSProxyEnabled }),
        React.createElement("h3", { className: "page-heading" }, "Querying"),
        React.createElement("div", { className: "gf-form-group" },
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(LegacyForms.FormField, { label: "Minimal step", labelWidth: 13, inputEl: React.createElement(LegacyForms.Input, { className: "width-6", value: options.jsonData.minStep, spellCheck: false, placeholder: "15s", onChange: (event) => {
                                onOptionsChange(Object.assign(Object.assign({}, options), { jsonData: Object.assign(Object.assign({}, options.jsonData), { minStep: event.currentTarget.value }) }));
                            }, validationEvents: {
                                [EventsWithValidation.onBlur]: [
                                    regexValidation(/^$|^\d+(ms|[Mwdhmsy])$/, 'Value is not valid, you can use number with time unit specifier: y, M, w, d, h, m, s'),
                                ],
                            } }), tooltip: "Minimal step used for metric query. Should be the same or higher as the scrape interval setting in the Pyroscope database." }))))));
};
//# sourceMappingURL=ConfigEditor.js.map