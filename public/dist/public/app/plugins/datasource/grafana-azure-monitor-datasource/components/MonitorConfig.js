import React, { useMemo } from 'react';
import { config } from '@grafana/runtime';
import { AzureCredentialsForm } from './AzureCredentialsForm';
import { getCredentials, updateCredentials } from '../credentials';
var azureClouds = [
    { value: 'azuremonitor', label: 'Azure' },
    { value: 'govazuremonitor', label: 'Azure US Government' },
    { value: 'germanyazuremonitor', label: 'Azure Germany' },
    { value: 'chinaazuremonitor', label: 'Azure China' },
];
export var MonitorConfig = function (props) {
    var updateOptions = props.updateOptions, getSubscriptions = props.getSubscriptions;
    var credentials = useMemo(function () { return getCredentials(props.options); }, [props.options]);
    var onCredentialsChange = function (credentials) {
        updateOptions(function (options) { return updateCredentials(options, credentials); });
    };
    return (React.createElement(React.Fragment, null,
        React.createElement("h3", { className: "page-heading" }, "Authentication"),
        React.createElement(AzureCredentialsForm, { managedIdentityEnabled: config.azure.managedIdentityEnabled, credentials: credentials, azureCloudOptions: azureClouds, onCredentialsChange: onCredentialsChange, getSubscriptions: getSubscriptions, disabled: props.options.readOnly })));
};
export default MonitorConfig;
//# sourceMappingURL=MonitorConfig.js.map