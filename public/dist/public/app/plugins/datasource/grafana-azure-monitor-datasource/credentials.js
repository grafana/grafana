import { __assign } from "tslib";
import { config } from '@grafana/runtime';
import { AzureCloud, } from './types';
var concealed = Symbol('Concealed client secret');
export function getAuthType(options) {
    if (!options.jsonData.azureAuthType) {
        // If authentication type isn't explicitly specified and datasource has client credentials,
        // then this is existing datasource which is configured for app registration (client secret)
        if (options.jsonData.tenantId && options.jsonData.clientId) {
            return 'clientsecret';
        }
        // For newly created datasource with no configuration, managed identity is the default authentication type
        // if they are enabled in Grafana config
        return config.azure.managedIdentityEnabled ? 'msi' : 'clientsecret';
    }
    return options.jsonData.azureAuthType;
}
function getDefaultAzureCloud() {
    switch (config.azure.cloud) {
        case AzureCloud.Public:
        case AzureCloud.None:
        case undefined:
            return 'azuremonitor';
        case AzureCloud.China:
            return 'chinaazuremonitor';
        case AzureCloud.USGovernment:
            return 'govazuremonitor';
        case AzureCloud.Germany:
            return 'germanyazuremonitor';
        default:
            throw new Error("The cloud '" + config.azure.cloud + "' not supported.");
    }
}
export function getAzurePortalUrl(azureCloud) {
    switch (azureCloud) {
        case 'azuremonitor':
            return 'https://portal.azure.com';
        case 'chinaazuremonitor':
            return 'https://portal.azure.cn';
        case 'govazuremonitor':
            return 'https://portal.azure.us';
        case 'germanyazuremonitor':
            return 'https://portal.microsoftazure.de';
        default:
            throw new Error('The cloud not supported.');
    }
}
export function getAzureCloud(options) {
    var authType = getAuthType(options);
    switch (authType) {
        case 'msi':
            // In case of managed identity, the cloud is always same as where Grafana is hosted
            return getDefaultAzureCloud();
        case 'clientsecret':
            return options.jsonData.cloudName || getDefaultAzureCloud();
    }
}
function getSecret(options) {
    var _a;
    if (options.secureJsonFields.clientSecret) {
        // The secret is concealed on server
        return concealed;
    }
    else {
        var secret = (_a = options.secureJsonData) === null || _a === void 0 ? void 0 : _a.clientSecret;
        return typeof secret === 'string' && secret.length > 0 ? secret : undefined;
    }
}
export function isCredentialsComplete(credentials) {
    switch (credentials.authType) {
        case 'msi':
            return true;
        case 'clientsecret':
            return !!(credentials.azureCloud && credentials.tenantId && credentials.clientId && credentials.clientSecret);
    }
}
export function getCredentials(options) {
    var authType = getAuthType(options);
    switch (authType) {
        case 'msi':
            if (config.azure.managedIdentityEnabled) {
                return {
                    authType: 'msi',
                    defaultSubscriptionId: options.jsonData.subscriptionId,
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
                azureCloud: options.jsonData.cloudName || getDefaultAzureCloud(),
                tenantId: options.jsonData.tenantId,
                clientId: options.jsonData.clientId,
                clientSecret: getSecret(options),
                defaultSubscriptionId: options.jsonData.subscriptionId,
            };
    }
}
export function updateCredentials(options, credentials) {
    switch (credentials.authType) {
        case 'msi':
            if (!config.azure.managedIdentityEnabled) {
                throw new Error('Managed Identity authentication is not enabled in Grafana config.');
            }
            options = __assign(__assign({}, options), { jsonData: __assign(__assign({}, options.jsonData), { azureAuthType: 'msi', subscriptionId: credentials.defaultSubscriptionId }) });
            return options;
        case 'clientsecret':
            options = __assign(__assign({}, options), { jsonData: __assign(__assign({}, options.jsonData), { azureAuthType: 'clientsecret', cloudName: credentials.azureCloud || getDefaultAzureCloud(), tenantId: credentials.tenantId, clientId: credentials.clientId, subscriptionId: credentials.defaultSubscriptionId }), secureJsonData: __assign(__assign({}, options.secureJsonData), { clientSecret: typeof credentials.clientSecret === 'string' && credentials.clientSecret.length > 0
                        ? credentials.clientSecret
                        : undefined }), secureJsonFields: __assign(__assign({}, options.secureJsonFields), { clientSecret: typeof credentials.clientSecret === 'symbol' }) });
            return options;
    }
}
export function isAppInsightsConfigured(options) {
    return !!(options.jsonData.appInsightsAppId && options.secureJsonFields.appInsightsApiKey);
}
//# sourceMappingURL=credentials.js.map