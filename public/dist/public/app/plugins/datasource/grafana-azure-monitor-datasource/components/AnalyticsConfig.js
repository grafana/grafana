import { __assign } from "tslib";
import React, { useMemo } from 'react';
import { AzureCredentialsForm } from './AzureCredentialsForm';
import { Button, Alert } from '@grafana/ui';
import { getCredentials } from '../credentials';
export var AnalyticsConfig = function (props) {
    var updateOptions = props.updateOptions;
    var primaryCredentials = useMemo(function () { return getCredentials(props.options); }, [props.options]);
    // Only show a section for setting LogAnalytics credentials if
    // they were set from before with different values and the
    // authType is supported
    var logCredentialsEnabled = primaryCredentials.authType === 'clientsecret' && props.options.jsonData.azureLogAnalyticsSameAs === false;
    var onClearAzLogsCreds = function () {
        updateOptions(function (options) {
            return __assign(__assign({}, options), { jsonData: __assign(__assign({}, options.jsonData), { azureLogAnalyticsSameAs: true }) });
        });
    };
    return logCredentialsEnabled ? (React.createElement(React.Fragment, null,
        React.createElement("h3", { className: "page-heading" }, "Azure Monitor Logs"),
        React.createElement(React.Fragment, null,
            React.createElement(Alert, { severity: "error", title: "Deprecated" }, "Using different credentials for Azure Monitor Logs is no longer supported. Authentication information above will be used instead. Please create a new data source with the credentials below."),
            React.createElement(AzureCredentialsForm, { managedIdentityEnabled: false, credentials: __assign(__assign({}, primaryCredentials), { authType: 'clientsecret', 
                    // Use deprecated Log Analytics credentials read-only
                    // to help with a possible migration
                    tenantId: props.options.jsonData.logAnalyticsTenantId, clientId: props.options.jsonData.logAnalyticsClientId }), disabled: true },
                React.createElement(Button, { onClick: onClearAzLogsCreds }, "Clear Azure Monitor Logs Credentials"))))) : null;
};
export default AnalyticsConfig;
//# sourceMappingURL=AnalyticsConfig.js.map