import { __awaiter } from "tslib";
import * as comlink from 'comlink';
import { useCallback, useEffect } from 'react';
import { useEnabled } from 'react-enable';
import { logError } from '@grafana/runtime';
import { logInfo } from './Analytics';
import { createWorker } from './createRouteGroupsMatcherWorker';
import { AlertingFeature } from './features';
let routeMatcher;
// Load worker loads the worker if it's not loaded yet
// and returns a function to dispose of the worker
// We do it to enable feature toggling. If the feature is disabled we don't wont to load the worker code at all
// An alternative way would be to move all this code to the hook below, but it will create and terminate the worker much more often
function loadWorker() {
    let worker;
    if (routeMatcher === undefined) {
        try {
            worker = createWorker();
            routeMatcher = comlink.wrap(worker);
        }
        catch (e) {
            if (e instanceof Error) {
                logError(e);
            }
        }
    }
    const disposeWorker = () => {
        if (worker && routeMatcher) {
            routeMatcher[comlink.releaseProxy]();
            worker.terminate();
            routeMatcher = undefined;
            worker = undefined;
        }
    };
    return { disposeWorker };
}
function validateWorker(toggleEnabled, matcher) {
    if (!toggleEnabled) {
        throw new Error('Matching routes preview is disabled');
    }
    if (!routeMatcher) {
        throw new Error('Route Matcher has not been initialized');
    }
}
export function useRouteGroupsMatcher() {
    const workerPreviewEnabled = useEnabled(AlertingFeature.NotificationPoliciesV2MatchingInstances);
    useEffect(() => {
        if (workerPreviewEnabled) {
            const { disposeWorker } = loadWorker();
            return disposeWorker;
        }
        return () => null;
    }, [workerPreviewEnabled]);
    const getRouteGroupsMap = useCallback((rootRoute, alertGroups) => __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        validateWorker(workerPreviewEnabled, routeMatcher);
        const startTime = performance.now();
        const result = yield routeMatcher.getRouteGroupsMap(rootRoute, alertGroups);
        const timeSpent = performance.now() - startTime;
        logInfo(`Route Groups Matched in  ${timeSpent} ms`, {
            matchingTime: timeSpent.toString(),
            alertGroupsCount: alertGroups.length.toString(),
            // Counting all nested routes might be too time-consuming, so we only count the first level
            topLevelRoutesCount: (_b = (_a = rootRoute.routes) === null || _a === void 0 ? void 0 : _a.length.toString()) !== null && _b !== void 0 ? _b : '0',
        });
        return result;
    }), [workerPreviewEnabled]);
    const matchInstancesToRoute = useCallback((rootRoute, instancesToMatch) => __awaiter(this, void 0, void 0, function* () {
        var _c, _d;
        validateWorker(workerPreviewEnabled, routeMatcher);
        const startTime = performance.now();
        const result = yield routeMatcher.matchInstancesToRoute(rootRoute, instancesToMatch);
        const timeSpent = performance.now() - startTime;
        logInfo(`Instances Matched in  ${timeSpent} ms`, {
            matchingTime: timeSpent.toString(),
            instancesToMatchCount: instancesToMatch.length.toString(),
            // Counting all nested routes might be too time-consuming, so we only count the first level
            topLevelRoutesCount: (_d = (_c = rootRoute.routes) === null || _c === void 0 ? void 0 : _c.length.toString()) !== null && _d !== void 0 ? _d : '0',
        });
        return result;
    }), [workerPreviewEnabled]);
    return { getRouteGroupsMap, matchInstancesToRoute };
}
//# sourceMappingURL=useRouteGroupsMatcher.js.map