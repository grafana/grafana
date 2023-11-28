import * as comlink from 'comlink';
import { Subscriber } from 'rxjs';
// Observers, ie. functions passed to `observable.subscribe(...)`, are converted to a subclass of `Subscriber` before they are sent to the source Observable.
// The conversion happens internally in the RxJS library - this transfer handler is catches them and wraps them with a proxy
const subscriberTransferHandler = {
    canHandle(value) {
        return Boolean(value && value instanceof Subscriber);
    },
    serialize(value) {
        const obj = comlink.proxy(value);
        const { port1, port2 } = new MessageChannel();
        comlink.expose(obj, port1);
        return [port2, [port2]];
    },
    deserialize(value) {
        value.start();
        return comlink.wrap(value);
    },
};
comlink.transferHandlers.set('SubscriberHandler', subscriberTransferHandler);
//# sourceMappingURL=transferHandlers.js.map