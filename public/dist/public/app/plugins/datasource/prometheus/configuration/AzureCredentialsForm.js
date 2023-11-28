import { cx } from '@emotion/css';
import React, { useEffect, useMemo, useReducer, useState } from 'react';
import { config } from '@grafana/runtime';
import { InlineFormLabel, Button } from '@grafana/ui/src/components';
import { Input } from '@grafana/ui/src/components/Forms/Legacy/Input/Input';
import { Select } from '@grafana/ui/src/components/Forms/Legacy/Select/Select';
import { isCredentialsComplete } from './AzureCredentials';
export const AzureCredentialsForm = (props) => {
    const { credentials, azureCloudOptions, onCredentialsChange, getSubscriptions, disabled, managedIdentityEnabled, workloadIdentityEnabled, } = props;
    const hasRequiredFields = isCredentialsComplete(credentials);
    const [subscriptions, setSubscriptions] = useState([]);
    const [loadSubscriptionsClicked, onLoadSubscriptions] = useReducer((val) => val + 1, 0);
    const authTypeOptions = useMemo(() => {
        let opts = [
            {
                value: 'clientsecret',
                label: 'App Registration',
            },
        ];
        if (managedIdentityEnabled) {
            opts.push({
                value: 'msi',
                label: 'Managed Identity',
            });
        }
        if (workloadIdentityEnabled) {
            opts.push({
                value: 'workloadidentity',
                label: 'Workload Identity',
            });
        }
        return opts;
    }, [managedIdentityEnabled, workloadIdentityEnabled]);
    useEffect(() => {
        if (!getSubscriptions || !hasRequiredFields) {
            updateSubscriptions([]);
            return;
        }
        let canceled = false;
        getSubscriptions().then((result) => {
            if (!canceled) {
                updateSubscriptions(result, loadSubscriptionsClicked);
            }
        });
        return () => {
            canceled = true;
        };
        // This effect is intended to be called only once initially and on Load Subscriptions click
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadSubscriptionsClicked]);
    const updateSubscriptions = (received, autoSelect = false) => {
        setSubscriptions(received);
        if (getSubscriptions) {
            if (autoSelect && !credentials.defaultSubscriptionId && received.length > 0) {
                // Selecting the default subscription if subscriptions received but no default subscription selected
                onSubscriptionChange(received[0]);
            }
            else if (credentials.defaultSubscriptionId) {
                const found = received.find((opt) => opt.value === credentials.defaultSubscriptionId);
                if (!found) {
                    // Unselecting the default subscription if it isn't found among the received subscriptions
                    onSubscriptionChange(undefined);
                }
            }
        }
    };
    const onAuthTypeChange = (selected) => {
        setSubscriptions([]);
        const defaultAuthType = managedIdentityEnabled
            ? 'msi'
            : workloadIdentityEnabled
                ? 'workloadidentity'
                : 'clientsecret';
        const updated = Object.assign(Object.assign({}, credentials), { authType: selected.value || defaultAuthType, defaultSubscriptionId: undefined });
        onCredentialsChange(updated);
    };
    const onAzureCloudChange = (selected) => {
        if (credentials.authType === 'clientsecret') {
            setSubscriptions([]);
            const updated = Object.assign(Object.assign({}, credentials), { azureCloud: selected.value, defaultSubscriptionId: undefined });
            onCredentialsChange(updated);
        }
    };
    const onTenantIdChange = (event) => {
        if (credentials.authType === 'clientsecret') {
            setSubscriptions([]);
            const updated = Object.assign(Object.assign({}, credentials), { tenantId: event.target.value, defaultSubscriptionId: undefined });
            onCredentialsChange(updated);
        }
    };
    const onClientIdChange = (event) => {
        if (credentials.authType === 'clientsecret') {
            setSubscriptions([]);
            const updated = Object.assign(Object.assign({}, credentials), { clientId: event.target.value, defaultSubscriptionId: undefined });
            onCredentialsChange(updated);
        }
    };
    const onClientSecretChange = (event) => {
        if (credentials.authType === 'clientsecret') {
            setSubscriptions([]);
            const updated = Object.assign(Object.assign({}, credentials), { clientSecret: event.target.value, defaultSubscriptionId: undefined });
            onCredentialsChange(updated);
        }
    };
    const onClientSecretReset = () => {
        if (credentials.authType === 'clientsecret') {
            setSubscriptions([]);
            const updated = Object.assign(Object.assign({}, credentials), { clientSecret: '', defaultSubscriptionId: undefined });
            onCredentialsChange(updated);
        }
    };
    const onSubscriptionChange = (selected) => {
        const updated = Object.assign(Object.assign({}, credentials), { defaultSubscriptionId: selected === null || selected === void 0 ? void 0 : selected.value });
        onCredentialsChange(updated);
    };
    const prometheusConfigOverhaulAuth = config.featureToggles.prometheusConfigOverhaulAuth;
    return (React.createElement("div", { className: "gf-form-group" },
        authTypeOptions.length > 1 && (React.createElement("div", { className: "gf-form-inline" },
            React.createElement("div", { className: "gf-form" },
                React.createElement(InlineFormLabel, { className: "width-12", tooltip: "Choose the type of authentication to Azure services" }, "Authentication"),
                React.createElement(Select, { className: "width-15", value: authTypeOptions.find((opt) => opt.value === credentials.authType), options: authTypeOptions, onChange: onAuthTypeChange, isDisabled: disabled })))),
        credentials.authType === 'clientsecret' && (React.createElement(React.Fragment, null,
            azureCloudOptions && (React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(InlineFormLabel, { className: "width-12", tooltip: "Choose an Azure Cloud" }, "Azure Cloud"),
                    React.createElement(Select, { className: "width-15", value: azureCloudOptions.find((opt) => opt.value === credentials.azureCloud), options: azureCloudOptions, onChange: onAzureCloudChange, isDisabled: disabled })))),
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(InlineFormLabel, { className: "width-12" }, "Directory (tenant) ID"),
                    React.createElement("div", { className: "width-15" },
                        React.createElement(Input, { className: cx(prometheusConfigOverhaulAuth ? 'width-20' : 'width-30'), placeholder: "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX", value: credentials.tenantId || '', onChange: onTenantIdChange, disabled: disabled })))),
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(InlineFormLabel, { className: "width-12" }, "Application (client) ID"),
                    React.createElement("div", { className: "width-15" },
                        React.createElement(Input, { className: cx(prometheusConfigOverhaulAuth ? 'width-20' : 'width-30'), placeholder: "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX", value: credentials.clientId || '', onChange: onClientIdChange, disabled: disabled })))),
            typeof credentials.clientSecret === 'symbol' ? (React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(InlineFormLabel, { htmlFor: "azure-client-secret", className: "width-12" }, "Client Secret"),
                    React.createElement(Input, { id: "azure-client-secret", className: cx(prometheusConfigOverhaulAuth ? 'width-20' : 'width-25'), placeholder: "configured", disabled: true })),
                !disabled && (React.createElement("div", { className: "gf-form" },
                    React.createElement("div", { className: cx(prometheusConfigOverhaulAuth ? 'max-width-20 gf-form-inline' : 'max-width-30 gf-form-inline') },
                        React.createElement(Button, { variant: "secondary", type: "button", onClick: onClientSecretReset }, "reset")))))) : (React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(InlineFormLabel, { className: "width-12" }, "Client Secret"),
                    React.createElement("div", { className: "width-15" },
                        React.createElement(Input, { className: cx(prometheusConfigOverhaulAuth ? 'width-20' : 'width-30'), placeholder: "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX", value: credentials.clientSecret || '', onChange: onClientSecretChange, disabled: disabled }))))))),
        getSubscriptions && (React.createElement(React.Fragment, null,
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(InlineFormLabel, { className: "width-12" }, "Default Subscription"),
                    React.createElement("div", { className: cx(prometheusConfigOverhaulAuth ? 'width-20' : 'width-25') },
                        React.createElement(Select, { value: credentials.defaultSubscriptionId
                                ? subscriptions.find((opt) => opt.value === credentials.defaultSubscriptionId)
                                : undefined, options: subscriptions, onChange: onSubscriptionChange, isDisabled: disabled })))),
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement("div", { className: "max-width-30 gf-form-inline" },
                        React.createElement(Button, { variant: "secondary", size: "sm", type: "button", onClick: onLoadSubscriptions, disabled: !hasRequiredFields }, "Load Subscriptions"))))))));
};
export default AzureCredentialsForm;
//# sourceMappingURL=AzureCredentialsForm.js.map