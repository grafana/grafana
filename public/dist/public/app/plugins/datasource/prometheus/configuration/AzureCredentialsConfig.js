import { config } from '@grafana/runtime';
import { AzureCloud } from './AzureCredentials';
const concealed = Symbol('Concealed client secret');
function getDefaultAzureCloud() {
    return config.azure.cloud || AzureCloud.Public;
}
function getSecret(options) {
    var _a;
    if (options.secureJsonFields.azureClientSecret) {
        // The secret is concealed on server
        return concealed;
    }
    else {
        const secret = (_a = options.secureJsonData) === null || _a === void 0 ? void 0 : _a.azureClientSecret;
        return typeof secret === 'string' && secret.length > 0 ? secret : undefined;
    }
}
export function hasCredentials(options) {
    return !!options.jsonData.azureCredentials;
}
export function getDefaultCredentials() {
    if (config.azure.managedIdentityEnabled) {
        return { authType: 'msi' };
    }
    else {
        return { authType: 'clientsecret', azureCloud: getDefaultAzureCloud() };
    }
}
export function getCredentials(options) {
    const credentials = options.jsonData.azureCredentials;
    // If no credentials saved, then return empty credentials
    // of type based on whether the managed identity enabled
    if (!credentials) {
        return getDefaultCredentials();
    }
    switch (credentials.authType) {
        case 'msi':
        case 'workloadidentity':
            if ((credentials.authType === 'msi' && config.azure.managedIdentityEnabled) ||
                (credentials.authType === 'workloadidentity' && config.azure.workloadIdentityEnabled)) {
                return {
                    authType: credentials.authType,
                };
            }
            else {
                // If authentication type is managed identity or workload identity but either method is disabled in Grafana config,
                // then we should fallback to an empty app registration (client secret) configuration
                return {
                    authType: 'clientsecret',
                    azureCloud: getDefaultAzureCloud(),
                };
            }
        case 'clientsecret':
            return {
                authType: 'clientsecret',
                azureCloud: credentials.azureCloud || getDefaultAzureCloud(),
                tenantId: credentials.tenantId,
                clientId: credentials.clientId,
                clientSecret: getSecret(options),
            };
    }
}
export function updateCredentials(options, credentials) {
    switch (credentials.authType) {
        case 'msi':
        case 'workloadidentity':
            if (credentials.authType === 'msi' && !config.azure.managedIdentityEnabled) {
                throw new Error('Managed Identity authentication is not enabled in Grafana config.');
            }
            if (credentials.authType === 'workloadidentity' && !config.azure.workloadIdentityEnabled) {
                throw new Error('Workload Identity authentication is not enabled in Grafana config.');
            }
            options = Object.assign(Object.assign({}, options), { jsonData: Object.assign(Object.assign({}, options.jsonData), { azureAuthType: credentials.authType, azureCredentials: {
                        authType: credentials.authType,
                    } }) });
            return options;
        case 'clientsecret':
            options = Object.assign(Object.assign({}, options), { jsonData: Object.assign(Object.assign({}, options.jsonData), { azureCredentials: {
                        authType: 'clientsecret',
                        azureCloud: credentials.azureCloud || getDefaultAzureCloud(),
                        tenantId: credentials.tenantId,
                        clientId: credentials.clientId,
                    } }), secureJsonData: Object.assign(Object.assign({}, options.secureJsonData), { azureClientSecret: typeof credentials.clientSecret === 'string' && credentials.clientSecret.length > 0
                        ? credentials.clientSecret
                        : undefined }), secureJsonFields: Object.assign(Object.assign({}, options.secureJsonFields), { azureClientSecret: typeof credentials.clientSecret === 'symbol' }) });
            return options;
    }
}
export function setDefaultCredentials(options) {
    return {
        jsonData: Object.assign(Object.assign({}, options.jsonData), { azureCredentials: getDefaultCredentials() }),
    };
}
export function resetCredentials(options) {
    return {
        jsonData: Object.assign(Object.assign({}, options.jsonData), { azureAuth: undefined, azureCredentials: undefined, azureEndpointResourceId: undefined }),
    };
}
//# sourceMappingURL=AzureCredentialsConfig.js.map