import { Subject } from 'rxjs';
export var FetchStatus;
(function (FetchStatus) {
    FetchStatus[FetchStatus["Pending"] = 0] = "Pending";
    FetchStatus[FetchStatus["InProgress"] = 1] = "InProgress";
    FetchStatus[FetchStatus["Done"] = 2] = "Done";
})(FetchStatus || (FetchStatus = {}));
export class FetchQueue {
    constructor(debug = false) {
        this.state = {}; // internal queue state
        this.queue = new Subject(); // internal stream for requests that are to be queued
        this.updates = new Subject(); // external stream with updates to the queue state
        this.add = (id, options) => this.queue.next({ id, options, state: FetchStatus.Pending });
        this.setInProgress = (id) => this.queue.next({ id, state: FetchStatus.InProgress });
        this.setDone = (id) => this.queue.next({ id, state: FetchStatus.Done });
        this.getUpdates = () => this.updates.asObservable();
        this.getUpdate = (state) => {
            const noOfInProgress = Object.keys(state).filter((key) => state[key].state === FetchStatus.InProgress).length;
            const noOfPending = Object.keys(state).filter((key) => state[key].state === FetchStatus.Pending).length;
            return { noOfPending, noOfInProgress, state };
        };
        this.publishUpdate = (update, debug) => {
            this.printState(update, debug);
            this.updates.next(update);
        };
        this.printState = (update, debug) => {
            if (!debug) {
                return;
            }
            const entriesWithoutOptions = Object.keys(update.state).reduce((all, key) => {
                const entry = { id: key, state: update.state[key].state };
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
        this.queue.subscribe((entry) => {
            const { id, state, options } = entry;
            if (!this.state[id]) {
                this.state[id] = { state: FetchStatus.Pending, options: { url: '' } };
            }
            if (state === FetchStatus.Done) {
                delete this.state[id];
                const update = this.getUpdate(this.state);
                this.publishUpdate(update, debug);
                return;
            }
            this.state[id].state = state;
            if (options) {
                this.state[id].options = options;
            }
            const update = this.getUpdate(this.state);
            this.publishUpdate(update, debug);
        });
    }
}
//# sourceMappingURL=FetchQueue.js.map