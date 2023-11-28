// TODO This value needs to be changed to grafana_alerting when the OnCall team introduces the necessary changes
export const GRAFANA_ONCALL_INTEGRATION_TYPE = 'grafana_alerting';
export var ReceiverTypes;
(function (ReceiverTypes) {
    ReceiverTypes["OnCall"] = "oncall";
})(ReceiverTypes || (ReceiverTypes = {}));
export const isInOnCallIntegrations = (url, integrationsUrls) => {
    return integrationsUrls.includes(url);
};
export const isOnCallReceiver = (receiver, integrations) => {
    var _a, _b, _c;
    if (!receiver.grafana_managed_receiver_configs) {
        return false;
    }
    // A receiver it's an onCall contact point if it includes only one integration, and this integration it's an onCall
    // An integration it's an onCall type if it's included in the list of integrations returned by the onCall api endpoint
    const onlyOneIntegration = receiver.grafana_managed_receiver_configs.length === 1;
    const isOnCall = isInOnCallIntegrations((_c = (_b = (_a = receiver.grafana_managed_receiver_configs[0]) === null || _a === void 0 ? void 0 : _a.settings) === null || _b === void 0 ? void 0 : _b.url) !== null && _c !== void 0 ? _c : '', integrations.map((i) => i.integration_url));
    return onlyOneIntegration && isOnCall;
};
//# sourceMappingURL=onCall.js.map