import { __awaiter } from "tslib";
import { Subject, of, Observable } from 'rxjs';
import { LiveChannelEventType, LiveChannelConnectionState, isValidLiveChannelAddress, } from '@grafana/data';
/**
 * Internal class that maps Centrifuge support to GrafanaLive
 */
export class CentrifugeLiveChannel {
    constructor(id, addr) {
        this.opened = Date.now();
        this.stream = new Subject();
        this.disconnectIfNoListeners = () => {
            const count = this.stream.observers.length;
            if (count === 0) {
                this.disconnect();
            }
        };
        this.id = id;
        this.addr = addr;
        this.currentStatus = {
            type: LiveChannelEventType.Status,
            id,
            timestamp: this.opened,
            state: LiveChannelConnectionState.Pending,
        };
        if (!isValidLiveChannelAddress(addr)) {
            this.currentStatus.state = LiveChannelConnectionState.Invalid;
            this.currentStatus.error = 'invalid channel address';
        }
    }
    // This should only be called when centrifuge is connected
    initalize() {
        if (this.initalized) {
            throw new Error('Channel already initalized: ' + this.id);
        }
        this.initalized = true;
        this.subscription.on('publication', (ctx) => {
            try {
                if (ctx.data) {
                    if (ctx.data.schema) {
                        this.lastMessageWithSchema = ctx.data;
                    }
                    this.stream.next({
                        type: LiveChannelEventType.Message,
                        message: ctx.data,
                    });
                }
                // Clear any error messages
                if (this.currentStatus.error) {
                    this.currentStatus.timestamp = Date.now();
                    delete this.currentStatus.error;
                    this.sendStatus();
                }
            }
            catch (err) {
                console.log('publish error', this.addr, err);
                this.currentStatus.error = err;
                this.currentStatus.timestamp = Date.now();
                this.sendStatus();
            }
        })
            .on('error', (ctx) => {
            this.currentStatus.timestamp = Date.now();
            this.currentStatus.error = ctx.error.message;
            this.sendStatus();
        })
            .on('subscribed', (ctx) => {
            var _a;
            this.currentStatus.timestamp = Date.now();
            this.currentStatus.state = LiveChannelConnectionState.Connected;
            delete this.currentStatus.error;
            if ((_a = ctx.data) === null || _a === void 0 ? void 0 : _a.schema) {
                this.lastMessageWithSchema = ctx.data;
            }
            this.sendStatus(ctx.data);
        })
            .on('unsubscribed', () => {
            this.currentStatus.timestamp = Date.now();
            this.currentStatus.state = LiveChannelConnectionState.Disconnected;
            this.sendStatus();
        })
            .on('subscribing', () => {
            this.currentStatus.timestamp = Date.now();
            this.currentStatus.state = LiveChannelConnectionState.Connecting;
            this.sendStatus();
        })
            .on('join', (ctx) => {
            this.stream.next({ type: LiveChannelEventType.Join, user: ctx.info.user });
        })
            .on('leave', (ctx) => {
            this.stream.next({ type: LiveChannelEventType.Leave, user: ctx.info.user });
        });
    }
    sendStatus(message) {
        const copy = Object.assign({}, this.currentStatus);
        if (message) {
            copy.message = message;
        }
        this.stream.next(copy);
    }
    /**
     * Get the stream of events and
     */
    getStream() {
        return new Observable((subscriber) => {
            var _a, _b;
            const initialMessage = Object.assign({}, this.currentStatus);
            if ((_a = this.lastMessageWithSchema) === null || _a === void 0 ? void 0 : _a.schema) {
                // send just schema instead of schema+data to avoid having data gaps
                initialMessage.message = { schema: (_b = this.lastMessageWithSchema) === null || _b === void 0 ? void 0 : _b.schema };
            }
            subscriber.next(Object.assign(Object.assign({}, this.currentStatus), { message: this.lastMessageWithSchema }));
            const sub = this.stream.subscribe(subscriber);
            return () => {
                sub.unsubscribe();
                const count = this.stream.observers.length;
                // Wait 1/4 second to fully disconnect
                if (count === 0) {
                    setTimeout(this.disconnectIfNoListeners, 250);
                }
            };
        });
    }
    /**
     * This is configured by the server when the config supports presence
     */
    getPresence() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.subscription) {
                return Promise.reject('not subscribed');
            }
            return this.subscription.presence().then((v) => {
                return {
                    users: Object.keys(v.clients),
                };
            });
        });
    }
    /**
     * This will close and terminate all streams for this channel
     */
    disconnect() {
        this.currentStatus.state = LiveChannelConnectionState.Shutdown;
        this.currentStatus.timestamp = Date.now();
        if (this.subscription) {
            this.subscription.unsubscribe();
            this.subscription.removeAllListeners(); // they keep all listeners attached after unsubscribe
            this.subscription = undefined;
        }
        this.stream.complete();
        this.stream.next(Object.assign({}, this.currentStatus));
        this.stream.complete();
        if (this.shutdownCallback) {
            this.shutdownCallback();
        }
    }
    shutdownWithError(err) {
        this.currentStatus.error = err;
        this.sendStatus();
        this.disconnect();
    }
}
export function getErrorChannel(msg, id, addr) {
    return {
        id,
        opened: Date.now(),
        addr,
        // return an error
        getStream: () => of({
            type: LiveChannelEventType.Status,
            id,
            timestamp: Date.now(),
            state: LiveChannelConnectionState.Invalid,
            error: msg,
        }),
        // already disconnected
        disconnect: () => { },
    };
}
//# sourceMappingURL=channel.js.map