import { __assign } from "tslib";
import { config } from '@grafana/runtime';
import { AzureCloud } from './AzureCredentials';
var concealed = Symbol('Concealed client secret');
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
        var secret = (_a = options.secureJsonData) === null || _a === void 0 ? void 0 : _a.azureClientSecret;
        return typeof secret === 'string' && secret.length > 0 ? secret : undefined;
    }
}
export function getCredentials(options) {
    var credentials = options.jsonData.azureCredentials;
    // If no credentials saved, then return empty credentials
    // of type based on whether the managed identity enabled
    if (!credentials) {
        return {
            authType: config.azure.managedIdentityEnabled ? 'msi' : 'clientsecret',
            azureCloud: getDefaultAzureCloud(),
        };
    }
    switch (credentials.authType) {
        case 'msi':
            if (config.azure.managedIdentityEnabled) {
                return {
                    authType: 'msi',
                };
            }
            else {
                // If authentication type is managed identity but managed identities were disabled in Grafana config,
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
            if (!config.azure.managedIdentityEnabled) {
                throw new Error('Managed Identity authentication is not enabled in Grafana config.');
            }
            options = __assign(__assign({}, options), { jsonData: __assign(__assign({}, options.jsonData), { azureCredentials: {
                        authType: 'msi',
                    } }) });
            return options;
        case 'clientsecret':
            options = __assign(__assign({}, options), { jsonData: __assign(__assign({}, options.jsonData), { azureCredentials: {
                        authType: 'clientsecret',
                        azureCloud: credentials.azureCloud || getDefaultAzureCloud(),
                        tenantId: credentials.tenantId,
                        clientId: credentials.clientId,
                    } }), secureJsonData: __assign(__assign({}, options.secureJsonData), { azureClientSecret: typeof credentials.clientSecret === 'string' && credentials.clientSecret.length > 0
                        ? credentials.clientSecret
                        : undefined }), secureJsonFields: __assign(__assign({}, options.secureJsonFields), { azureClientSecret: typeof credentials.clientSecret === 'symbol' }) });
            return options;
    }
}
//# sourceMappingURL=AzureCredentialsConfig.js.map