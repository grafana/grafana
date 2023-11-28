import React, { useMemo } from 'react';
import { ConfigSection } from '@grafana/experimental';
import { Button, Select, Field, Input } from '@grafana/ui';
import { selectors } from '../e2e/selectors';
export const AzureCredentialsForm = (props) => {
    const { credentials, azureCloudOptions, onCredentialsChange, disabled, managedIdentityEnabled, workloadIdentityEnabled, } = props;
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
    const onAuthTypeChange = (selected) => {
        const defaultAuthType = managedIdentityEnabled
            ? 'msi'
            : workloadIdentityEnabled
                ? 'workloadidentity'
                : 'clientsecret';
        const updated = Object.assign(Object.assign({}, credentials), { authType: selected.value || defaultAuthType });
        onCredentialsChange(updated);
    };
    const onAzureCloudChange = (selected) => {
        if (credentials.authType === 'clientsecret') {
            const updated = Object.assign(Object.assign({}, credentials), { azureCloud: selected.value });
            onCredentialsChange(updated);
        }
    };
    const onTenantIdChange = (event) => {
        if (credentials.authType === 'clientsecret') {
            const updated = Object.assign(Object.assign({}, credentials), { tenantId: event.target.value });
            onCredentialsChange(updated);
        }
    };
    const onClientIdChange = (event) => {
        if (credentials.authType === 'clientsecret') {
            const updated = Object.assign(Object.assign({}, credentials), { clientId: event.target.value });
            onCredentialsChange(updated);
        }
    };
    const onClientSecretChange = (event) => {
        if (credentials.authType === 'clientsecret') {
            const updated = Object.assign(Object.assign({}, credentials), { clientSecret: event.target.value });
            onCredentialsChange(updated);
        }
    };
    const onClientSecretReset = () => {
        if (credentials.authType === 'clientsecret') {
            const updated = Object.assign(Object.assign({}, credentials), { clientSecret: '' });
            onCredentialsChange(updated);
        }
    };
    return (React.createElement(ConfigSection, { title: "Authentication" },
        authTypeOptions.length > 1 && (React.createElement(Field, { label: "Authentication", description: "Choose the type of authentication to Azure services", "data-testid": selectors.components.configEditor.authType.select, htmlFor: "authentication-type" },
            React.createElement(Select, { className: "width-15", value: authTypeOptions.find((opt) => opt.value === credentials.authType), options: authTypeOptions, onChange: onAuthTypeChange, disabled: disabled }))),
        credentials.authType === 'clientsecret' && (React.createElement(React.Fragment, null,
            azureCloudOptions && (React.createElement(Field, { label: "Azure Cloud", "data-testid": selectors.components.configEditor.azureCloud.input, htmlFor: "azure-cloud-type", disabled: disabled },
                React.createElement(Select, { inputId: "azure-cloud-type", "aria-label": "Azure Cloud", className: "width-15", value: azureCloudOptions.find((opt) => opt.value === credentials.azureCloud), options: azureCloudOptions, onChange: onAzureCloudChange }))),
            React.createElement(Field, { label: "Directory (tenant) ID", required: true, "data-testid": selectors.components.configEditor.tenantID.input, htmlFor: "tenant-id", invalid: !credentials.tenantId, error: 'Tenant ID is required' },
                React.createElement(Input, { "aria-label": "Tenant ID", className: "width-30", placeholder: "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX", value: credentials.tenantId || '', onChange: onTenantIdChange, disabled: disabled })),
            React.createElement(Field, { label: "Application (client) ID", required: true, "data-testid": selectors.components.configEditor.clientID.input, htmlFor: "client-id", invalid: !credentials.clientId, error: 'Client ID is required' },
                React.createElement(Input, { className: "width-30", "aria-label": "Client ID", placeholder: "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX", value: credentials.clientId || '', onChange: onClientIdChange, disabled: disabled })),
            !disabled &&
                (typeof credentials.clientSecret === 'symbol' ? (React.createElement(Field, { label: "Client Secret", htmlFor: "client-secret", required: true },
                    React.createElement("div", { className: "width-30", style: { display: 'flex', gap: '4px' } },
                        React.createElement(Input, { "aria-label": "Client Secret", placeholder: "configured", disabled: true, "data-testid": 'client-secret' }),
                        React.createElement(Button, { variant: "secondary", type: "button", onClick: onClientSecretReset, disabled: disabled }, "Reset")))) : (React.createElement(Field, { label: "Client Secret", "data-testid": selectors.components.configEditor.clientSecret.input, required: true, htmlFor: "client-secret", invalid: !credentials.clientSecret, error: 'Client secret is required' },
                    React.createElement(Input, { className: "width-30", "aria-label": "Client Secret", placeholder: "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX", value: credentials.clientSecret || '', onChange: onClientSecretChange, id: "client-secret", disabled: disabled })))))),
        props.children));
};
export default AzureCredentialsForm;
//# sourceMappingURL=AzureCredentialsForm.js.map