import { AzureCloud, AzureAuthType, } from '../types';
export const getDefaultCredentials = (managedIdentityEnabled, cloud) => {
    if (managedIdentityEnabled) {
        return { authType: AzureAuthType.MSI };
    }
    else {
        return { authType: AzureAuthType.CLIENT_SECRET, azureCloud: cloud };
    }
};
export const getSecret = (clientSecretStoredServerSide, clientSecret) => {
    const concealedSecret = Symbol('Concealed client secret');
    if (clientSecretStoredServerSide) {
        // The secret is concealed server side, so return the symbol
        return concealedSecret;
    }
    else {
        return typeof clientSecret === 'string' && clientSecret.length > 0 ? clientSecret : undefined;
    }
};
export const getCredentials = (dsSettings, bootConfig) => {
    var _a, _b, _c, _d, _e;
    // JSON data
    const credentials = (_a = dsSettings.jsonData) === null || _a === void 0 ? void 0 : _a.azureCredentials;
    // Secure JSON data/fields
    const clientSecretStoredServerSide = (_b = dsSettings.secureJsonFields) === null || _b === void 0 ? void 0 : _b.azureClientSecret;
    const clientSecret = (_c = dsSettings.secureJsonData) === null || _c === void 0 ? void 0 : _c.azureClientSecret;
    // BootConfig data
    const managedIdentityEnabled = !!((_d = bootConfig.azure) === null || _d === void 0 ? void 0 : _d.managedIdentityEnabled);
    const cloud = ((_e = bootConfig.azure) === null || _e === void 0 ? void 0 : _e.cloud) || AzureCloud.Public;
    // If no credentials saved, then return empty credentials
    // of type based on whether the managed identity enabled
    if (!credentials) {
        return getDefaultCredentials(managedIdentityEnabled, cloud);
    }
    switch (credentials.authType) {
        case AzureAuthType.MSI:
            if (managedIdentityEnabled) {
                return {
                    authType: AzureAuthType.MSI,
                };
            }
            else {
                // If authentication type is managed identity but managed identities were disabled in Grafana config,
                // then we should fallback to an empty app registration (client secret) configuration
                return {
                    authType: AzureAuthType.CLIENT_SECRET,
                    azureCloud: cloud,
                };
            }
        case AzureAuthType.CLIENT_SECRET:
            return {
                authType: AzureAuthType.CLIENT_SECRET,
                azureCloud: credentials.azureCloud || cloud,
                tenantId: credentials.tenantId,
                clientId: credentials.clientId,
                clientSecret: getSecret(clientSecretStoredServerSide, clientSecret),
            };
    }
};
export const updateCredentials = (dsSettings, bootConfig, credentials) => {
    var _a, _b;
    // BootConfig data
    const managedIdentityEnabled = !!((_a = bootConfig.azure) === null || _a === void 0 ? void 0 : _a.managedIdentityEnabled);
    const cloud = ((_b = bootConfig.azure) === null || _b === void 0 ? void 0 : _b.cloud) || AzureCloud.Public;
    switch (credentials.authType) {
        case AzureAuthType.MSI:
            if (!managedIdentityEnabled) {
                throw new Error('Managed Identity authentication is not enabled in Grafana config.');
            }
            dsSettings = Object.assign(Object.assign({}, dsSettings), { jsonData: Object.assign(Object.assign({}, dsSettings.jsonData), { azureCredentials: {
                        authType: AzureAuthType.MSI,
                    } }) });
            return dsSettings;
        case AzureAuthType.CLIENT_SECRET:
            dsSettings = Object.assign(Object.assign({}, dsSettings), { jsonData: Object.assign(Object.assign({}, dsSettings.jsonData), { azureCredentials: {
                        authType: AzureAuthType.CLIENT_SECRET,
                        azureCloud: credentials.azureCloud || cloud,
                        tenantId: credentials.tenantId,
                        clientId: credentials.clientId,
                    } }), secureJsonData: Object.assign(Object.assign({}, dsSettings.secureJsonData), { azureClientSecret: typeof credentials.clientSecret === 'string' && credentials.clientSecret.length > 0
                        ? credentials.clientSecret
                        : undefined }), secureJsonFields: Object.assign(Object.assign({}, dsSettings.secureJsonFields), { azureClientSecret: typeof credentials.clientSecret === 'symbol' }) });
            return dsSettings;
    }
};
//# sourceMappingURL=AzureCredentialsConfig.js.map