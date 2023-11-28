import { countBy } from 'lodash';
import { getUsedContactPoints } from '../contact-points/utils';
export function useAlertmanagerConfigHealth(config) {
    var _a, _b;
    if (!config.receivers) {
        return { contactPoints: {} };
    }
    if (!config.route) {
        return { contactPoints: Object.fromEntries(config.receivers.map((r) => [r.name, { matchingRoutes: 0 }])) };
    }
    const definedContactPointNames = (_b = (_a = config.receivers) === null || _a === void 0 ? void 0 : _a.map((receiver) => receiver.name)) !== null && _b !== void 0 ? _b : [];
    const usedContactPoints = getUsedContactPoints(config.route);
    const usedContactPointCounts = countBy(usedContactPoints);
    const contactPointsHealth = {};
    const configHealth = { contactPoints: contactPointsHealth };
    definedContactPointNames.forEach((contactPointName) => {
        var _a;
        contactPointsHealth[contactPointName] = { matchingRoutes: (_a = usedContactPointCounts[contactPointName]) !== null && _a !== void 0 ? _a : 0 };
    });
    return configHealth;
}
//# sourceMappingURL=useAlertmanagerConfigHealth.js.map