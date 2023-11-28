import { __awaiter } from "tslib";
import './transferHandlers';
import * as comlink from 'comlink';
import { remoteObservableAsObservable } from './remoteObservable';
import { CentrifugeService } from './service';
let centrifuge;
const initialize = (deps, remoteDataStreamSubscriberReadiness) => {
    centrifuge = new CentrifugeService(Object.assign(Object.assign({}, deps), { dataStreamSubscriberReadiness: remoteObservableAsObservable(remoteDataStreamSubscriberReadiness) }));
};
const getConnectionState = () => {
    return comlink.proxy(centrifuge.getConnectionState());
};
const getDataStream = (options) => {
    return comlink.proxy(centrifuge.getDataStream(options));
};
const getQueryData = (options) => __awaiter(void 0, void 0, void 0, function* () {
    return yield centrifuge.getQueryData(options);
});
const getStream = (address) => {
    return comlink.proxy(centrifuge.getStream(address));
};
const getPresence = (address) => __awaiter(void 0, void 0, void 0, function* () {
    return yield centrifuge.getPresence(address);
});
const workObj = {
    initialize,
    getConnectionState,
    getDataStream,
    getStream,
    getQueryData,
    getPresence,
};
comlink.expose(workObj);
export default class {
    constructor() { }
}
//# sourceMappingURL=service.worker.js.map