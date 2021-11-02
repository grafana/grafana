import { Subject } from 'rxjs';
import { filter } from 'rxjs/operators';
var ResponseQueue = /** @class */ (function () {
    function ResponseQueue(fetchQueue, fetch) {
        var _this = this;
        this.queue = new Subject(); // internal stream for requests that are to be executed
        this.responses = new Subject(); // external stream with responses from fetch
        this.add = function (id, options) {
            _this.queue.next({ id: id, options: options });
        };
        this.getResponses = function (id) {
            return _this.responses.asObservable().pipe(filter(function (entry) { return entry.id === id; }));
        };
        // This will create an implicit live subscription for as long as this class lives.
        // But as FetchQueue is used by the singleton backendSrv that also lives for as long as Grafana app lives
        // I think this ok. We could add some disposable pattern later if the need arises.
        this.queue.subscribe(function (entry) {
            var id = entry.id, options = entry.options;
            // Let the fetchQueue know that this id has started data fetching.
            fetchQueue.setInProgress(id);
            _this.responses.next({ id: id, observable: fetch(options) });
        });
    }
    return ResponseQueue;
}());
export { ResponseQueue };
//# sourceMappingURL=ResponseQueue.js.map