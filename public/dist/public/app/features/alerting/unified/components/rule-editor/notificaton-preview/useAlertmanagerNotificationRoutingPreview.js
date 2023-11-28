import { __awaiter } from "tslib";
import { useMemo } from 'react';
import { useAsync } from 'react-use';
import { useAlertmanagerConfig } from '../../../hooks/useAlertmanagerConfig';
import { useRouteGroupsMatcher } from '../../../useRouteGroupsMatcher';
import { addUniqueIdentifierToRoute } from '../../../utils/amroutes';
import { computeInheritedTree, normalizeRoute } from '../../../utils/notification-policies';
import { getRoutesByIdMap } from './route';
export const useAlertmanagerNotificationRoutingPreview = (alertManagerSourceName, potentialInstances) => {
    var _a;
    const { currentData, isLoading: configLoading, error: configError } = useAlertmanagerConfig(alertManagerSourceName);
    const config = currentData === null || currentData === void 0 ? void 0 : currentData.alertmanager_config;
    const { matchInstancesToRoute } = useRouteGroupsMatcher();
    // to create the list of matching contact points we need to first get the rootRoute
    const { rootRoute, receivers } = useMemo(() => {
        var _a;
        if (!config) {
            return {
                receivers: [],
                rootRoute: undefined,
            };
        }
        return {
            rootRoute: config.route ? normalizeRoute(addUniqueIdentifierToRoute(config.route)) : undefined,
            receivers: (_a = config.receivers) !== null && _a !== void 0 ? _a : [],
        };
    }, [config]);
    // create maps for routes to be get by id, this map also contains the path to the route
    // ⚠️ don't forget to compute the inherited tree before using this map
    const routesByIdMap = rootRoute
        ? getRoutesByIdMap(computeInheritedTree(rootRoute))
        : new Map();
    // create map for receivers to be get by name
    const receiversByName = (_a = receivers.reduce((map, receiver) => {
        return map.set(receiver.name, receiver);
    }, new Map())) !== null && _a !== void 0 ? _a : new Map();
    // match labels in the tree => map of notification policies and the alert instances (list of labels) in each one
    const { value: matchingMap = new Map(), loading: matchingLoading, error: matchingError, } = useAsync(() => __awaiter(void 0, void 0, void 0, function* () {
        if (!rootRoute) {
            return;
        }
        return yield matchInstancesToRoute(rootRoute, potentialInstances);
    }), [rootRoute, potentialInstances]);
    return {
        routesByIdMap,
        receiversByName,
        matchingMap,
        loading: configLoading || matchingLoading,
        error: configError !== null && configError !== void 0 ? configError : matchingError,
    };
};
//# sourceMappingURL=useAlertmanagerNotificationRoutingPreview.js.map