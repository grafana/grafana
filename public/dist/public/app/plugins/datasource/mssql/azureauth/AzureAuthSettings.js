import React, { useMemo } from 'react';
import { config } from '@grafana/runtime';
import { KnownAzureClouds } from './AzureCredentials';
import { getCredentials, updateCredentials } from './AzureCredentialsConfig';
import { AzureCredentialsForm } from './AzureCredentialsForm';
export const AzureAuthSettings = (props) => {
    const { dataSourceConfig: dsSettings, onChange } = props;
    const managedIdentityEnabled = config.azure.managedIdentityEnabled;
    const credentials = useMemo(() => getCredentials(dsSettings, config), [dsSettings]);
    const onCredentialsChange = (credentials) => {
        onChange(updateCredentials(dsSettings, config, credentials));
    };
    return (React.createElement(AzureCredentialsForm, { managedIdentityEnabled: managedIdentityEnabled, credentials: credentials, azureCloudOptions: KnownAzureClouds, onCredentialsChange: onCredentialsChange, disabled: dsSettings.readOnly }));
};
export default AzureAuthSettings;
//# sourceMappingURL=AzureAuthSettings.js.map