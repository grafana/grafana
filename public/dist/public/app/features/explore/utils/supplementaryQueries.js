import { cloneDeep, groupBy } from 'lodash';
import { distinct, Observable, merge } from 'rxjs';
import { scan } from 'rxjs/operators';
import { hasSupplementaryQuerySupport, isTruthy, LoadingState, LogsVolumeType, SupplementaryQueryType, } from '@grafana/data';
import store from 'app/core/store';
import { makeDataFramesForLogs } from '../../logs/logsModel';
export const supplementaryQueryTypes = [
    SupplementaryQueryType.LogsVolume,
    SupplementaryQueryType.LogsSample,
];
const getSupplementaryQuerySettingKey = (type) => `grafana.explore.logs.enable${type}`;
export const storeSupplementaryQueryEnabled = (enabled, type) => {
    store.set(getSupplementaryQuerySettingKey(type), enabled ? 'true' : 'false');
};
export const loadSupplementaryQueries = () => {
    // We default to true for all supp queries
    let supplementaryQueries = {
        [SupplementaryQueryType.LogsVolume]: { enabled: true },
        [SupplementaryQueryType.LogsSample]: { enabled: false },
    };
    for (const type of supplementaryQueryTypes) {
        // We want to skip LogsSample and default it to false for now to trigger it only on user action
        if (type === SupplementaryQueryType.LogsSample) {
            continue;
        }
        // Only if "false" value in local storage, we disable it
        const shouldBeEnabled = store.get(getSupplementaryQuerySettingKey(type));
        if (shouldBeEnabled === 'false') {
            supplementaryQueries[type] = { enabled: false };
        }
    }
    return supplementaryQueries;
};
const createFallbackLogVolumeProvider = (explorePanelData, queryTargets, datasourceName) => {
    return new Observable((observer) => {
        return explorePanelData.subscribe((exploreData) => {
            if (exploreData.logsResult &&
                exploreData.logsResult.rows &&
                exploreData.logsResult.visibleRange &&
                exploreData.logsResult.bucketSize !== undefined &&
                exploreData.state === LoadingState.Done) {
                const bucketSize = exploreData.logsResult.bucketSize;
                const targetRefIds = queryTargets.map((query) => query.refId);
                const rowsByRefId = groupBy(exploreData.logsResult.rows, 'dataFrame.refId');
                let allSeries = [];
                targetRefIds.forEach((refId) => {
                    var _a, _b;
                    if ((_a = rowsByRefId[refId]) === null || _a === void 0 ? void 0 : _a.length) {
                        const series = makeDataFramesForLogs(rowsByRefId[refId], bucketSize);
                        allSeries = [...allSeries, ...series];
                        const logVolumeCustomMetaData = {
                            logsVolumeType: LogsVolumeType.Limited,
                            absoluteRange: (_b = exploreData.logsResult) === null || _b === void 0 ? void 0 : _b.visibleRange,
                            datasourceName,
                            sourceQuery: queryTargets.find((query) => query.refId === refId),
                        };
                        observer.next({
                            data: allSeries.map((d) => {
                                var _a;
                                const custom = ((_a = d.meta) === null || _a === void 0 ? void 0 : _a.custom) || {};
                                return Object.assign(Object.assign({}, d), { meta: {
                                        custom: Object.assign(Object.assign({}, custom), logVolumeCustomMetaData),
                                    } });
                            }),
                            state: exploreData.state,
                        });
                    }
                });
                observer.complete();
            }
        });
    });
};
const getSupplementaryQueryFallback = (type, explorePanelData, queryTargets, datasourceName) => {
    if (type === SupplementaryQueryType.LogsVolume) {
        return createFallbackLogVolumeProvider(explorePanelData, queryTargets, datasourceName);
    }
    else {
        return undefined;
    }
};
export const getSupplementaryQueryProvider = (groupedQueries, type, request, explorePanelData) => {
    const providers = groupedQueries.map(({ datasource, targets }, i) => {
        const dsRequest = cloneDeep(request);
        dsRequest.requestId = `${dsRequest.requestId || ''}_${i}`;
        dsRequest.targets = targets;
        if (hasSupplementaryQuerySupport(datasource, type)) {
            return datasource.getDataProvider(type, dsRequest);
        }
        else {
            return getSupplementaryQueryFallback(type, explorePanelData, targets, datasource.name);
        }
    });
    const definedProviders = providers.filter(isTruthy);
    if (definedProviders.length === 0) {
        return undefined;
    }
    else if (definedProviders.length === 1) {
        return definedProviders[0];
    }
    return merge(...definedProviders).pipe(scan((acc, next) => {
        if ((acc.errors && acc.errors.length) || next.state === LoadingState.NotStarted) {
            return acc;
        }
        if (next.state === LoadingState.Loading && acc.state === LoadingState.NotStarted) {
            return Object.assign(Object.assign({}, acc), { state: LoadingState.Loading });
        }
        if (next.state && next.state !== LoadingState.Done) {
            return acc;
        }
        return Object.assign(Object.assign({}, acc), { data: [...acc.data, ...next.data], state: LoadingState.Done });
    }, { data: [], state: LoadingState.NotStarted }), distinct());
};
//# sourceMappingURL=supplementaryQueries.js.map