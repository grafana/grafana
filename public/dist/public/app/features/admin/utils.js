import { config } from '@grafana/runtime/src';
// https://html.spec.whatwg.org/multipage/input.html#valid-e-mail-address
export const w3cStandardEmailValidator = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
export function isTrial() {
    var _a;
    const expiry = (_a = config.licenseInfo) === null || _a === void 0 ? void 0 : _a.trialExpiry;
    return !!(expiry && expiry > 0);
}
export const highlightTrial = () => isTrial() && config.featureToggles.featureHighlights;
//# sourceMappingURL=utils.js.map