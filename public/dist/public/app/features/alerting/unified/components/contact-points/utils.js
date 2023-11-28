import { countBy, split, trim } from 'lodash';
import { computeInheritedTree } from '../../utils/notification-policies';
import { extractReceivers } from '../../utils/receivers';
import { RECEIVER_STATUS_KEY } from './useContactPoints';
export function isProvisioned(contactPoint) {
    var _a, _b;
    // for some reason the provenance is on the receiver and not the entire contact point
    const provenance = (_b = (_a = contactPoint.grafana_managed_receiver_configs) === null || _a === void 0 ? void 0 : _a.find((receiver) => receiver.provenance)) === null || _b === void 0 ? void 0 : _b.provenance;
    return Boolean(provenance);
}
// TODO we should really add some type information to these receiver settings...
export function getReceiverDescription(receiver) {
    switch (receiver.type) {
        case 'email': {
            const hasEmailAddresses = 'addresses' in receiver.settings; // when dealing with alertmanager email_configs we don't normalize the settings
            return hasEmailAddresses ? summarizeEmailAddresses(receiver.settings['addresses']) : undefined;
        }
        case 'slack': {
            const channelName = receiver.settings['recipient'];
            return channelName ? `#${channelName}` : undefined;
        }
        case 'kafka': {
            const topicName = receiver.settings['kafkaTopic'];
            return topicName;
        }
        case 'webhook': {
            const url = receiver.settings['url'];
            return url;
        }
        default:
            return undefined;
    }
}
// input: foo+1@bar.com, foo+2@bar.com, foo+3@bar.com, foo+4@bar.com
// output: foo+1@bar.com, foo+2@bar.com, +2 more
function summarizeEmailAddresses(addresses) {
    const MAX_ADDRESSES_SHOWN = 3;
    const SUPPORTED_SEPARATORS = /,|;|\n+/g;
    const emails = addresses.trim().split(SUPPORTED_SEPARATORS).map(trim);
    const notShown = emails.length - MAX_ADDRESSES_SHOWN;
    const truncatedAddresses = split(addresses, SUPPORTED_SEPARATORS, MAX_ADDRESSES_SHOWN);
    if (notShown > 0) {
        truncatedAddresses.push(`+${notShown} more`);
    }
    return truncatedAddresses.join(', ');
}
/**
 * This function adds the status information for each of the integrations (contact point types) in a contact point
 * 1. we iterate over all contact points
 * 2. for each contact point we "enhance" it with the status or "undefined" for vanilla Alertmanager
 */
export function enhanceContactPointsWithStatus(result, status = []) {
    var _a, _b, _c;
    const contactPoints = (_a = result.alertmanager_config.receivers) !== null && _a !== void 0 ? _a : [];
    // compute the entire inherited tree before finding what notification policies are using a particular contact point
    const fullyInheritedTree = computeInheritedTree((_c = (_b = result === null || result === void 0 ? void 0 : result.alertmanager_config) === null || _b === void 0 ? void 0 : _b.route) !== null && _c !== void 0 ? _c : {});
    const usedContactPoints = getUsedContactPoints(fullyInheritedTree);
    const usedContactPointsByName = countBy(usedContactPoints);
    return contactPoints.map((contactPoint) => {
        var _a;
        const receivers = extractReceivers(contactPoint);
        const statusForReceiver = status.find((status) => status.name === contactPoint.name);
        return Object.assign(Object.assign({}, contactPoint), { numberOfPolicies: (_a = usedContactPointsByName[contactPoint.name]) !== null && _a !== void 0 ? _a : 0, grafana_managed_receiver_configs: receivers.map((receiver, index) => (Object.assign(Object.assign({}, receiver), { [RECEIVER_STATUS_KEY]: statusForReceiver === null || statusForReceiver === void 0 ? void 0 : statusForReceiver.integrations[index] }))) });
    });
}
export function getUsedContactPoints(route) {
    var _a, _b;
    const childrenContactPoints = (_b = (_a = route.routes) === null || _a === void 0 ? void 0 : _a.flatMap((route) => getUsedContactPoints(route))) !== null && _b !== void 0 ? _b : [];
    if (route.receiver) {
        return [route.receiver, ...childrenContactPoints];
    }
    return childrenContactPoints;
}
//# sourceMappingURL=utils.js.map