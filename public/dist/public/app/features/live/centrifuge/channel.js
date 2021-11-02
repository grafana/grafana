import { __assign, __awaiter, __generator } from "tslib";
import { LiveChannelEventType, LiveChannelConnectionState, } from '@grafana/data';
import { Subject, of, Observable } from 'rxjs';
/**
 * Internal class that maps Centrifuge support to GrafanaLive
 */
var CentrifugeLiveChannel = /** @class */ (function () {
    function CentrifugeLiveChannel(id, addr) {
        var _this = this;
        this.opened = Date.now();
        this.stream = new Subject();
        this.disconnectIfNoListeners = function () {
            var count = _this.stream.observers.length;
            if (count === 0) {
                _this.disconnect();
            }
        };
        this.id = id;
        this.addr = addr;
        this.currentStatus = {
            type: LiveChannelEventType.Status,
            id: id,
            timestamp: this.opened,
            state: LiveChannelConnectionState.Pending,
        };
    }
    // This should only be called when centrifuge is connected
    CentrifugeLiveChannel.prototype.initalize = function (config) {
        var _this = this;
        if (this.config) {
            throw new Error('Channel already initalized: ' + this.id);
        }
        this.config = config;
        var events = {
            // Called when a message is recieved from the socket
            publish: function (ctx) {
                try {
                    if (ctx.data) {
                        if (ctx.data.schema) {
                            _this.lastMessageWithSchema = ctx.data;
                        }
                        _this.stream.next({
                            type: LiveChannelEventType.Message,
                            message: ctx.data,
                        });
                    }
                    // Clear any error messages
                    if (_this.currentStatus.error) {
                        _this.currentStatus.timestamp = Date.now();
                        delete _this.currentStatus.error;
                        _this.sendStatus();
                    }
                }
                catch (err) {
                    console.log('publish error', _this.addr, err);
                    _this.currentStatus.error = err;
                    _this.currentStatus.timestamp = Date.now();
                    _this.sendStatus();
                }
            },
            error: function (ctx) {
                _this.currentStatus.timestamp = Date.now();
                _this.currentStatus.error = ctx.error;
                _this.sendStatus();
            },
            subscribe: function (ctx) {
                var _a;
                _this.currentStatus.timestamp = Date.now();
                _this.currentStatus.state = LiveChannelConnectionState.Connected;
                delete _this.currentStatus.error;
                if ((_a = ctx.data) === null || _a === void 0 ? void 0 : _a.schema) {
                    _this.lastMessageWithSchema = ctx.data;
                }
                _this.sendStatus(ctx.data);
            },
            unsubscribe: function (ctx) {
                _this.currentStatus.timestamp = Date.now();
                _this.currentStatus.state = LiveChannelConnectionState.Disconnected;
                _this.sendStatus();
            },
        };
        if (config.hasPresence) {
            events.join = function (ctx) {
                _this.stream.next({ type: LiveChannelEventType.Join, user: ctx.info.user });
            };
            events.leave = function (ctx) {
                _this.stream.next({ type: LiveChannelEventType.Leave, user: ctx.info.user });
            };
        }
        return events;
    };
    CentrifugeLiveChannel.prototype.sendStatus = function (message) {
        var copy = __assign({}, this.currentStatus);
        if (message) {
            copy.message = message;
        }
        this.stream.next(copy);
    };
    /**
     * Get the stream of events and
     */
    CentrifugeLiveChannel.prototype.getStream = function () {
        var _this = this;
        return new Observable(function (subscriber) {
            subscriber.next(__assign({}, _this.currentStatus));
            var sub = _this.stream.subscribe(subscriber);
            return function () {
                sub.unsubscribe();
                var count = _this.stream.observers.length;
                // Wait 1/4 second to fully disconnect
                if (count === 0) {
                    setTimeout(_this.disconnectIfNoListeners, 250);
                }
            };
        });
    };
    /**
     * This is configured by the server when the config supports presence
     */
    CentrifugeLiveChannel.prototype.getPresence = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!this.subscription) {
                    return [2 /*return*/, Promise.reject('not subscribed')];
                }
                return [2 /*return*/, this.subscription.presence().then(function (v) {
                        return {
                            users: Object.keys(v.presence),
                        };
                    })];
            });
        });
    };
    /**
     * This will close and terminate all streams for this channel
     */
    CentrifugeLiveChannel.prototype.disconnect = function () {
        this.currentStatus.state = LiveChannelConnectionState.Shutdown;
        this.currentStatus.timestamp = Date.now();
        if (this.subscription) {
            this.subscription.unsubscribe();
            this.subscription.removeAllListeners(); // they keep all listeners attached after unsubscribe
            this.subscription = undefined;
        }
        this.stream.complete();
        this.stream.next(__assign({}, this.currentStatus));
        this.stream.complete();
        if (this.shutdownCallback) {
            this.shutdownCallback();
        }
    };
    CentrifugeLiveChannel.prototype.shutdownWithError = function (err) {
        this.currentStatus.error = err;
        this.sendStatus();
        this.disconnect();
    };
    return CentrifugeLiveChannel;
}());
export { CentrifugeLiveChannel };
export function getErrorChannel(msg, id, addr) {
    return {
        id: id,
        opened: Date.now(),
        addr: addr,
        // return an error
        getStream: function () {
            return of({
                type: LiveChannelEventType.Status,
                id: id,
                timestamp: Date.now(),
                state: LiveChannelConnectionState.Invalid,
                error: msg,
            });
        },
        // already disconnected
        disconnect: function () { },
    };
}
//# sourceMappingURL=channel.js.map