import { AzureAuthType } from '../types';
export const configWithManagedIdentityEnabled = {
    azure: { managedIdentityEnabled: true, workloadIdentityEnabled: false, userIdentityEnabled: false },
};
export const configWithManagedIdentityDisabled = {
    azure: {
        managedIdentityEnabled: false,
        workloadIdentityEnabled: false,
        userIdentityEnabled: false,
        cloud: 'AzureCloud',
    },
};
export const dataSourceSettingsWithMsiCredentials = {
    jsonData: { azureCredentials: { authType: AzureAuthType.MSI } },
};
const basicJSONData = {
    jsonData: {
        azureCredentials: {
            authType: AzureAuthType.CLIENT_SECRET,
            tenantId: 'XXXX-tenant-id-XXXX',
            clientId: 'XXXX-client-id-XXXX',
        },
    },
};
// Will return symbol as the secret is concealed
export const dataSourceSettingsWithClientSecretOnServer = Object.assign(Object.assign({}, basicJSONData), { secureJsonFields: { azureClientSecret: true } });
// Will return the secret as a string from the secureJsonData
export const dataSourceSettingsWithClientSecretInSecureJSONData = Object.assign(Object.assign({}, basicJSONData), { secureJsonData: { azureClientSecret: 'XXXX-super-secret-secret-XXXX' } });
//# sourceMappingURL=AzureAuth.testMocks.js.map