import { concatMap, filter } from 'rxjs/operators';
import { FetchStatus } from './FetchQueue';
import { isDataQuery } from '../utils/query';
var FetchQueueWorker = /** @class */ (function () {
    function FetchQueueWorker(fetchQueue, responseQueue, config) {
        var maxParallelRequests = (config === null || config === void 0 ? void 0 : config.http2Enabled) ? 1000 : 5; // for tests that don't mock GrafanaBootConfig the config param will be undefined
        // This will create an implicit live subscription for as long as this class lives.
        // But as FetchQueueWorker is used by the singleton backendSrv that also lives for as long as Grafana app lives
        // I think this ok. We could add some disposable pattern later if the need arises.
        fetchQueue
            .getUpdates()
            .pipe(filter(function (_a) {
            var noOfPending = _a.noOfPending;
            return noOfPending > 0;
        }), // no reason to act if there is nothing to act upon
        // Using concatMap instead of mergeMap so that the order with apiRequests first is preserved
        // https://rxjs.dev/api/operators/concatMap
        concatMap(function (_a) {
            var state = _a.state, noOfInProgress = _a.noOfInProgress;
            var apiRequests = Object.keys(state)
                .filter(function (k) { return state[k].state === FetchStatus.Pending && !isDataQuery(state[k].options.url); })
                .reduce(function (all, key) {
                var entry = { id: key, options: state[key].options };
                all.push(entry);
                return all;
            }, []);
            var dataRequests = Object.keys(state)
                .filter(function (key) { return state[key].state === FetchStatus.Pending && isDataQuery(state[key].options.url); })
                .reduce(function (all, key) {
                var entry = { id: key, options: state[key].options };
                all.push(entry);
                return all;
            }, []);
            // apiRequests have precedence over data requests and should always be called directly
            // this means we can end up with a negative value.
            // Because the way Array.toSlice works with negative numbers we use Math.max below.
            var noOfAllowedDataRequests = Math.max(maxParallelRequests - noOfInProgress - apiRequests.length, 0);
            var dataRequestToFetch = dataRequests.slice(0, noOfAllowedDataRequests);
            return apiRequests.concat(dataRequestToFetch);
        }))
            .subscribe(function (_a) {
            var id = _a.id, options = _a.options;
            // This will add an entry to the responseQueue
            responseQueue.add(id, options);
        });
    }
    return FetchQueueWorker;
}());
export { FetchQueueWorker };
//# sourceMappingURL=FetchQueueWorker.js.map