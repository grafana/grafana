export var AzureCloud;
(function (AzureCloud) {
    AzureCloud["Public"] = "AzureCloud";
    AzureCloud["China"] = "AzureChinaCloud";
    AzureCloud["USGovernment"] = "AzureUSGovernment";
    AzureCloud["Germany"] = "AzureGermanCloud";
    AzureCloud["None"] = "";
})(AzureCloud || (AzureCloud = {}));
export var KnownAzureClouds = [
    { value: AzureCloud.Public, label: 'Azure' },
    { value: AzureCloud.China, label: 'Azure China' },
    { value: AzureCloud.USGovernment, label: 'Azure US Government' },
    { value: AzureCloud.Germany, label: 'Azure Germany' },
];
export function isCredentialsComplete(credentials) {
    switch (credentials.authType) {
        case 'msi':
            return true;
        case 'clientsecret':
            return !!(credentials.azureCloud && credentials.tenantId && credentials.clientId && credentials.clientSecret);
    }
}
//# sourceMappingURL=AzureCredentials.js.map