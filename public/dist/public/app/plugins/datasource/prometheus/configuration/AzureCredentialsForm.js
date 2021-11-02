import { __assign, __read } from "tslib";
import React, { useEffect, useReducer, useState } from 'react';
import { InlineFormLabel, Button } from '@grafana/ui/src/components';
import { Select } from '@grafana/ui/src/components/Forms/Legacy/Select/Select';
import { Input } from '@grafana/ui/src/components/Forms/Legacy/Input/Input';
import { isCredentialsComplete } from './AzureCredentials';
var authTypeOptions = [
    {
        value: 'msi',
        label: 'Managed Identity',
    },
    {
        value: 'clientsecret',
        label: 'App Registration',
    },
];
export var AzureCredentialsForm = function (props) {
    var credentials = props.credentials, azureCloudOptions = props.azureCloudOptions, onCredentialsChange = props.onCredentialsChange, getSubscriptions = props.getSubscriptions;
    var hasRequiredFields = isCredentialsComplete(credentials);
    var _a = __read(useState([]), 2), subscriptions = _a[0], setSubscriptions = _a[1];
    var _b = __read(useReducer(function (val) { return val + 1; }, 0), 2), loadSubscriptionsClicked = _b[0], onLoadSubscriptions = _b[1];
    useEffect(function () {
        if (!getSubscriptions || !hasRequiredFields) {
            updateSubscriptions([]);
            return;
        }
        var canceled = false;
        getSubscriptions().then(function (result) {
            if (!canceled) {
                updateSubscriptions(result, loadSubscriptionsClicked);
            }
        });
        return function () {
            canceled = true;
        };
        // This effect is intended to be called only once initially and on Load Subscriptions click
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadSubscriptionsClicked]);
    var updateSubscriptions = function (received, autoSelect) {
        if (autoSelect === void 0) { autoSelect = false; }
        setSubscriptions(received);
        if (getSubscriptions) {
            if (autoSelect && !credentials.defaultSubscriptionId && received.length > 0) {
                // Selecting the default subscription if subscriptions received but no default subscription selected
                onSubscriptionChange(received[0]);
            }
            else if (credentials.defaultSubscriptionId) {
                var found = received.find(function (opt) { return opt.value === credentials.defaultSubscriptionId; });
                if (!found) {
                    // Unselecting the default subscription if it isn't found among the received subscriptions
                    onSubscriptionChange(undefined);
                }
            }
        }
    };
    var onAuthTypeChange = function (selected) {
        if (onCredentialsChange) {
            setSubscriptions([]);
            var updated = __assign(__assign({}, credentials), { authType: selected.value || 'msi', defaultSubscriptionId: undefined });
            onCredentialsChange(updated);
        }
    };
    var onAzureCloudChange = function (selected) {
        if (onCredentialsChange && credentials.authType === 'clientsecret') {
            setSubscriptions([]);
            var updated = __assign(__assign({}, credentials), { azureCloud: selected.value, defaultSubscriptionId: undefined });
            onCredentialsChange(updated);
        }
    };
    var onTenantIdChange = function (event) {
        if (onCredentialsChange && credentials.authType === 'clientsecret') {
            setSubscriptions([]);
            var updated = __assign(__assign({}, credentials), { tenantId: event.target.value, defaultSubscriptionId: undefined });
            onCredentialsChange(updated);
        }
    };
    var onClientIdChange = function (event) {
        if (onCredentialsChange && credentials.authType === 'clientsecret') {
            setSubscriptions([]);
            var updated = __assign(__assign({}, credentials), { clientId: event.target.value, defaultSubscriptionId: undefined });
            onCredentialsChange(updated);
        }
    };
    var onClientSecretChange = function (event) {
        if (onCredentialsChange && credentials.authType === 'clientsecret') {
            setSubscriptions([]);
            var updated = __assign(__assign({}, credentials), { clientSecret: event.target.value, defaultSubscriptionId: undefined });
            onCredentialsChange(updated);
        }
    };
    var onClientSecretReset = function () {
        if (onCredentialsChange && credentials.authType === 'clientsecret') {
            setSubscriptions([]);
            var updated = __assign(__assign({}, credentials), { clientSecret: '', defaultSubscriptionId: undefined });
            onCredentialsChange(updated);
        }
    };
    var onSubscriptionChange = function (selected) {
        if (onCredentialsChange) {
            var updated = __assign(__assign({}, credentials), { defaultSubscriptionId: selected === null || selected === void 0 ? void 0 : selected.value });
            onCredentialsChange(updated);
        }
    };
    return (React.createElement("div", { className: "gf-form-group" },
        props.managedIdentityEnabled && (React.createElement("div", { className: "gf-form-inline" },
            React.createElement("div", { className: "gf-form" },
                React.createElement(InlineFormLabel, { className: "width-12", tooltip: "Choose the type of authentication to Azure services" }, "Authentication"),
                React.createElement(Select, { menuShouldPortal: true, className: "width-15", value: authTypeOptions.find(function (opt) { return opt.value === credentials.authType; }), options: authTypeOptions, onChange: onAuthTypeChange })))),
        credentials.authType === 'clientsecret' && (React.createElement(React.Fragment, null,
            azureCloudOptions && (React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(InlineFormLabel, { className: "width-12", tooltip: "Choose an Azure Cloud" }, "Azure Cloud"),
                    React.createElement(Select, { menuShouldPortal: true, className: "width-15", value: azureCloudOptions.find(function (opt) { return opt.value === credentials.azureCloud; }), options: azureCloudOptions, onChange: onAzureCloudChange })))),
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(InlineFormLabel, { className: "width-12" }, "Directory (tenant) ID"),
                    React.createElement("div", { className: "width-15" },
                        React.createElement(Input, { className: "width-30", placeholder: "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX", value: credentials.tenantId || '', onChange: onTenantIdChange })))),
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(InlineFormLabel, { className: "width-12" }, "Application (client) ID"),
                    React.createElement("div", { className: "width-15" },
                        React.createElement(Input, { className: "width-30", placeholder: "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX", value: credentials.clientId || '', onChange: onClientIdChange })))),
            typeof credentials.clientSecret === 'symbol' ? (React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(InlineFormLabel, { className: "width-12" }, "Client Secret"),
                    React.createElement(Input, { className: "width-25", placeholder: "configured", disabled: true })),
                React.createElement("div", { className: "gf-form" },
                    React.createElement("div", { className: "max-width-30 gf-form-inline" },
                        React.createElement(Button, { variant: "secondary", type: "button", onClick: onClientSecretReset }, "reset"))))) : (React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(InlineFormLabel, { className: "width-12" }, "Client Secret"),
                    React.createElement("div", { className: "width-15" },
                        React.createElement(Input, { className: "width-30", placeholder: "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX", value: credentials.clientSecret || '', onChange: onClientSecretChange }))))))),
        getSubscriptions && (React.createElement(React.Fragment, null,
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(InlineFormLabel, { className: "width-12" }, "Default Subscription"),
                    React.createElement("div", { className: "width-25" },
                        React.createElement(Select, { menuShouldPortal: true, value: credentials.defaultSubscriptionId
                                ? subscriptions.find(function (opt) { return opt.value === credentials.defaultSubscriptionId; })
                                : undefined, options: subscriptions, onChange: onSubscriptionChange })))),
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement("div", { className: "max-width-30 gf-form-inline" },
                        React.createElement(Button, { variant: "secondary", size: "sm", type: "button", onClick: onLoadSubscriptions, disabled: !hasRequiredFields }, "Load Subscriptions"))))))));
};
export default AzureCredentialsForm;
//# sourceMappingURL=AzureCredentialsForm.js.map