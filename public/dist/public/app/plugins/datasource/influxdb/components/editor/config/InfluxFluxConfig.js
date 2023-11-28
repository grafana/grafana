import { uniqueId } from 'lodash';
import React from 'react';
import { onUpdateDatasourceJsonDataOption, onUpdateDatasourceSecureJsonDataOption, updateDatasourcePluginResetOption, } from '@grafana/data';
import { InlineField, InlineFieldRow, Input, SecretInput } from '@grafana/ui';
const WIDTH_SHORT = 20;
export const InfluxFluxConfig = (props) => {
    const { options: { jsonData, secureJsonData, secureJsonFields }, } = props;
    const htmlPrefix = uniqueId('influxdb-flux-config');
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { labelWidth: WIDTH_SHORT, label: "Organization", htmlFor: `${htmlPrefix}-org` },
                React.createElement(Input, { id: `${htmlPrefix}-org`, className: "width-20", value: jsonData.organization || '', onChange: onUpdateDatasourceJsonDataOption(props, 'organization') }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { labelWidth: WIDTH_SHORT, label: "Token" },
                React.createElement(SecretInput, { isConfigured: Boolean(secureJsonFields && secureJsonFields.token), value: (secureJsonData === null || secureJsonData === void 0 ? void 0 : secureJsonData.token) || '', label: "Token", "aria-label": "Token", className: "width-20", onReset: () => updateDatasourcePluginResetOption(props, 'token'), onChange: onUpdateDatasourceSecureJsonDataOption(props, 'token') }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { labelWidth: WIDTH_SHORT, label: "Default Bucket" },
                React.createElement(Input, { className: "width-20", placeholder: "default bucket", value: jsonData.defaultBucket || '', onChange: onUpdateDatasourceJsonDataOption(props, 'defaultBucket') }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { labelWidth: WIDTH_SHORT, label: "Min time interval", tooltip: "A lower limit for the auto group by time interval. Recommended to be set to write frequency,\n\t\t\t\tfor example 1m if your data is written every minute." },
                React.createElement(Input, { className: "width-20", placeholder: "10s", value: jsonData.timeInterval || '', onChange: onUpdateDatasourceJsonDataOption(props, 'timeInterval') })))));
};
//# sourceMappingURL=InfluxFluxConfig.js.map