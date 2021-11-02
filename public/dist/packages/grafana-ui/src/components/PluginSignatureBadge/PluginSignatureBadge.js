import { __assign, __rest } from "tslib";
import React from 'react';
import { PluginSignatureStatus } from '@grafana/data';
import { Badge } from '../Badge/Badge';
/**
 * @public
 */
export var PluginSignatureBadge = function (_a) {
    var status = _a.status, otherProps = __rest(_a, ["status"]);
    var display = getSignatureDisplayModel(status);
    return (React.createElement(Badge, __assign({ text: display.text, color: display.color, icon: display.icon, tooltip: display.tooltip }, otherProps)));
};
PluginSignatureBadge.displayName = 'PluginSignatureBadge';
function getSignatureDisplayModel(signature) {
    if (!signature) {
        signature = PluginSignatureStatus.invalid;
    }
    switch (signature) {
        case PluginSignatureStatus.internal:
            return { text: 'Core', color: 'blue', tooltip: 'Core plugin that is bundled with Grafana' };
        case PluginSignatureStatus.valid:
            return { text: 'Signed', icon: 'lock', color: 'green', tooltip: 'Signed and verified plugin' };
        case PluginSignatureStatus.invalid:
            return {
                text: 'Invalid signature',
                icon: 'exclamation-triangle',
                color: 'red',
                tooltip: 'Invalid plugin signature',
            };
        case PluginSignatureStatus.modified:
            return {
                text: 'Modified signature',
                icon: 'exclamation-triangle',
                color: 'red',
                tooltip: 'Valid signature but content has been modified',
            };
        case PluginSignatureStatus.missing:
            return {
                text: 'Missing signature',
                icon: 'exclamation-triangle',
                color: 'red',
                tooltip: 'Missing plugin signature',
            };
        default:
            return {
                text: 'Unsigned',
                icon: 'exclamation-triangle',
                color: 'red',
                tooltip: 'Unsigned external plugin',
            };
    }
}
//# sourceMappingURL=PluginSignatureBadge.js.map