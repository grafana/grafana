import { Subject } from 'rxjs';
import { filter } from 'rxjs/operators';
export class ResponseQueue {
    constructor(fetchQueue, fetch) {
        this.queue = new Subject(); // internal stream for requests that are to be executed
        this.responses = new Subject(); // external stream with responses from fetch
        this.add = (id, options) => {
            this.queue.next({ id, options });
        };
        this.getResponses = (id) => this.responses.asObservable().pipe(filter((entry) => entry.id === id));
        // This will create an implicit live subscription for as long as this class lives.
        // But as FetchQueue is used by the singleton backendSrv that also lives for as long as Grafana app lives
        // I think this ok. We could add some disposable pattern later if the need arises.
        this.queue.subscribe((entry) => {
            const { id, options } = entry;
            // Let the fetchQueue know that this id has started data fetching.
            fetchQueue.setInProgress(id);
            this.responses.next({ id, observable: fetch(options) });
        });
    }
}
//# sourceMappingURL=ResponseQueue.js.map