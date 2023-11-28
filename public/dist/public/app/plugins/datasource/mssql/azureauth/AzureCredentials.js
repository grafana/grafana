import { AzureAuthType } from '../types';
export var AzureCloud;
(function (AzureCloud) {
    AzureCloud["Public"] = "AzureCloud";
    AzureCloud["None"] = "";
})(AzureCloud || (AzureCloud = {}));
export const KnownAzureClouds = [{ value: AzureCloud.Public, label: 'Azure' }];
export function isCredentialsComplete(credentials) {
    switch (credentials.authType) {
        case AzureAuthType.MSI:
            return true;
        case AzureAuthType.CLIENT_SECRET:
            return !!(credentials.azureCloud && credentials.tenantId && credentials.clientId && credentials.clientSecret);
    }
}
//# sourceMappingURL=AzureCredentials.js.map