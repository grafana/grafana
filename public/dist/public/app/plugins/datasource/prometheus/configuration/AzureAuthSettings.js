import { __assign } from "tslib";
import React, { useMemo } from 'react';
import { InlineFormLabel, Input } from '@grafana/ui';
import { config } from '@grafana/runtime';
import { KnownAzureClouds } from './AzureCredentials';
import { getCredentials, updateCredentials } from './AzureCredentialsConfig';
import { AzureCredentialsForm } from './AzureCredentialsForm';
export var AzureAuthSettings = function (props) {
    var dataSourceConfig = props.dataSourceConfig, onChange = props.onChange;
    var credentials = useMemo(function () { return getCredentials(dataSourceConfig); }, [dataSourceConfig]);
    var onCredentialsChange = function (credentials) {
        onChange(updateCredentials(dataSourceConfig, credentials));
    };
    return (React.createElement(React.Fragment, null,
        React.createElement("h6", null, "Azure Authentication"),
        React.createElement(AzureCredentialsForm, { managedIdentityEnabled: config.azure.managedIdentityEnabled, credentials: credentials, azureCloudOptions: KnownAzureClouds, onCredentialsChange: onCredentialsChange }),
        React.createElement("h6", null, "Azure Configuration"),
        React.createElement("div", { className: "gf-form-group" },
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(InlineFormLabel, { className: "width-12" }, "AAD resource ID"),
                    React.createElement("div", { className: "width-15" },
                        React.createElement(Input, { className: "width-30", value: dataSourceConfig.jsonData.azureEndpointResourceId || '', onChange: function (event) {
                                return onChange(__assign(__assign({}, dataSourceConfig), { jsonData: __assign(__assign({}, dataSourceConfig.jsonData), { azureEndpointResourceId: event.currentTarget.value }) }));
                            } })))))));
};
export default AzureAuthSettings;
//# sourceMappingURL=AzureAuthSettings.js.map