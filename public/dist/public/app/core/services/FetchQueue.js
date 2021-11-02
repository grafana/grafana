import { Subject } from 'rxjs';
export var FetchStatus;
(function (FetchStatus) {
    FetchStatus[FetchStatus["Pending"] = 0] = "Pending";
    FetchStatus[FetchStatus["InProgress"] = 1] = "InProgress";
    FetchStatus[FetchStatus["Done"] = 2] = "Done";
})(FetchStatus || (FetchStatus = {}));
var FetchQueue = /** @class */ (function () {
    function FetchQueue(debug) {
        var _this = this;
        if (debug === void 0) { debug = false; }
        this.state = {}; // internal queue state
        this.queue = new Subject(); // internal stream for requests that are to be queued
        this.updates = new Subject(); // external stream with updates to the queue state
        this.add = function (id, options) { return _this.queue.next({ id: id, options: options, state: FetchStatus.Pending }); };
        this.setInProgress = function (id) { return _this.queue.next({ id: id, state: FetchStatus.InProgress }); };
        this.setDone = function (id) { return _this.queue.next({ id: id, state: FetchStatus.Done }); };
        this.getUpdates = function () { return _this.updates.asObservable(); };
        this.getUpdate = function (state) {
            var noOfInProgress = Object.keys(state).filter(function (key) { return state[key].state === FetchStatus.InProgress; }).length;
            var noOfPending = Object.keys(state).filter(function (key) { return state[key].state === FetchStatus.Pending; }).length;
            return { noOfPending: noOfPending, noOfInProgress: noOfInProgress, state: state };
        };
        this.publishUpdate = function (update, debug) {
            _this.printState(update, debug);
            _this.updates.next(update);
        };
        this.printState = function (update, debug) {
            if (!debug) {
                return;
            }
            var entriesWithoutOptions = Object.keys(update.state).reduce(function (all, key) {
                var entry = { id: key, state: update.state[key].state };
                all.push(entry);
                return all;
            }, []);
            console.log('FetchQueue noOfStarted', update.noOfInProgress);
            console.log('FetchQueue noOfNotStarted', update.noOfPending);
            console.log('FetchQueue state', entriesWithoutOptions);
        };
        // This will create an implicit live subscription for as long as this class lives.
        // But as FetchQueue is used by the singleton backendSrv that also lives for as long as Grafana app lives
        // I think this ok. We could add some disposable pattern later if the need arises.
        this.queue.subscribe(function (entry) {
            var id = entry.id, state = entry.state, options = entry.options;
            if (!_this.state[id]) {
                _this.state[id] = { state: FetchStatus.Pending, options: {} };
            }
            if (state === FetchStatus.Done) {
                delete _this.state[id];
                var update_1 = _this.getUpdate(_this.state);
                _this.publishUpdate(update_1, debug);
                return;
            }
            _this.state[id].state = state;
            if (options) {
                _this.state[id].options = options;
            }
            var update = _this.getUpdate(_this.state);
            _this.publishUpdate(update, debug);
        });
    }
    return FetchQueue;
}());
export { FetchQueue };
//# sourceMappingURL=FetchQueue.js.map