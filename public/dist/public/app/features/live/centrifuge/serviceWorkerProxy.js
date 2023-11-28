import { __awaiter } from "tslib";
import './transferHandlers';
import * as comlink from 'comlink';
import { asyncScheduler, observeOn } from 'rxjs';
import { createWorker } from './createCentrifugeServiceWorker';
import { promiseWithRemoteObservableAsObservable } from './remoteObservable';
export class CentrifugeServiceWorkerProxy {
    constructor(deps) {
        this.getConnectionState = () => {
            return promiseWithRemoteObservableAsObservable(this.centrifugeWorker.getConnectionState());
        };
        this.getDataStream = (options) => {
            return promiseWithRemoteObservableAsObservable(this.centrifugeWorker.getDataStream(options)).pipe(
            // async scheduler splits the synchronous task of deserializing data from web worker and
            // consuming the message (ie. updating react component) into two to avoid blocking the event loop
            observeOn(asyncScheduler));
        };
        /**
         * Query over websocket
         */
        this.getQueryData = (options) => __awaiter(this, void 0, void 0, function* () {
            const optionsAsPlainSerializableObject = JSON.parse(JSON.stringify(options));
            return this.centrifugeWorker.getQueryData(optionsAsPlainSerializableObject);
        });
        this.getPresence = (address) => {
            return this.centrifugeWorker.getPresence(address);
        };
        this.getStream = (address) => {
            return promiseWithRemoteObservableAsObservable(this.centrifugeWorker.getStream(address));
        };
        this.centrifugeWorker = comlink.wrap(createWorker());
        this.centrifugeWorker.initialize(deps, comlink.proxy(deps.dataStreamSubscriberReadiness));
    }
}
//# sourceMappingURL=serviceWorkerProxy.js.map