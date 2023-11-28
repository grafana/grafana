import React from 'react';
import { Button, Field, Select, Input } from '@grafana/ui/src/components';
import { AzureAuthType } from '../types';
const authTypeOptions = [
    {
        value: AzureAuthType.MSI,
        label: 'Managed Identity',
    },
    {
        value: AzureAuthType.CLIENT_SECRET,
        label: 'App Registration',
    },
];
export const AzureCredentialsForm = (props) => {
    const { managedIdentityEnabled, credentials, azureCloudOptions, onCredentialsChange, disabled } = props;
    const onAuthTypeChange = (selected) => {
        if (onCredentialsChange) {
            const updated = Object.assign(Object.assign({}, credentials), { authType: selected.value || AzureAuthType.MSI });
            onCredentialsChange(updated);
        }
    };
    const onInputChange = ({ property, value }) => {
        if (onCredentialsChange && credentials.authType === 'clientsecret') {
            const updated = Object.assign(Object.assign({}, credentials), { [property]: value });
            onCredentialsChange(updated);
        }
    };
    return (React.createElement("div", null,
        managedIdentityEnabled && (React.createElement(Field, { label: "Authentication", description: "Choose the type of authentication to Azure services", htmlFor: "authentication-type" },
            React.createElement(Select, { width: 20, value: authTypeOptions.find((opt) => opt.value === credentials.authType), options: authTypeOptions, onChange: onAuthTypeChange, disabled: disabled }))),
        credentials.authType === 'clientsecret' && (React.createElement(React.Fragment, null,
            azureCloudOptions && (React.createElement(Field, { label: "Azure Cloud", htmlFor: "azure-cloud-type", disabled: disabled },
                React.createElement(Select, { value: azureCloudOptions.find((opt) => opt.value === credentials.azureCloud), options: azureCloudOptions, onChange: (selected) => {
                        const value = selected.value || '';
                        onInputChange({ property: 'azureCloud', value });
                    }, isDisabled: disabled, inputId: "azure-cloud-type", "aria-label": "Azure Cloud", width: 20 }))),
            React.createElement(Field, { label: "Directory (tenant) ID", required: true, htmlFor: "tenant-id", invalid: !credentials.tenantId, error: 'Tenant ID is required' },
                React.createElement(Input, { width: 45, placeholder: "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX", value: credentials.tenantId || '', onChange: (event) => {
                        const value = event.target.value;
                        onInputChange({ property: 'tenantId', value });
                    }, disabled: disabled, "aria-label": "Tenant ID" })),
            React.createElement(Field, { label: "Application (client) ID", required: true, htmlFor: "client-id", invalid: !credentials.clientId, error: 'Client ID is required' },
                React.createElement(Input, { width: 45, placeholder: "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX", value: credentials.clientId || '', onChange: (event) => {
                        const value = event.target.value;
                        onInputChange({ property: 'clientId', value });
                    }, disabled: disabled, "aria-label": "Client ID" })),
            !disabled &&
                (typeof credentials.clientSecret === 'symbol' ? (React.createElement(Field, { label: "Client Secret", htmlFor: "client-secret", required: true },
                    React.createElement("div", { className: "width-30", style: { display: 'flex', gap: '4px' } },
                        React.createElement(Input, { "aria-label": "Client Secret", placeholder: "configured", disabled: true, "data-testid": 'client-secret', width: 45 }),
                        React.createElement(Button, { variant: "secondary", type: "button", onClick: () => {
                                onInputChange({ property: 'clientSecret', value: '' });
                            }, disabled: disabled }, "Reset")))) : (React.createElement(Field, { label: "Client Secret", required: true, htmlFor: "client-secret", invalid: !credentials.clientSecret, error: 'Client secret is required' },
                    React.createElement(Input, { width: 45, "aria-label": "Client Secret", placeholder: "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX", value: credentials.clientSecret || '', onChange: (event) => {
                            const value = event.target.value;
                            onInputChange({ property: 'clientSecret', value });
                        }, id: "client-secret", disabled: disabled }))))))));
};
export default AzureCredentialsForm;
//# sourceMappingURL=AzureCredentialsForm.js.map