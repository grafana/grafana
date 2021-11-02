import { __assign, __awaiter, __generator } from "tslib";
import Centrifuge from 'centrifuge/dist/centrifuge';
import { toDataQueryError } from '@grafana/runtime';
import { BehaviorSubject, Observable } from 'rxjs';
import { dataFrameToJSON, isLiveChannelMessageEvent, isLiveChannelStatusEvent, LiveChannelConnectionState, LoadingState, StreamingDataFrame, } from '@grafana/data';
import { CentrifugeLiveChannel } from './channel';
import { liveTimer } from 'app/features/dashboard/dashgrid/liveTimer';
var CentrifugeSrv = /** @class */ (function () {
    function CentrifugeSrv(deps) {
        var _this = this;
        this.deps = deps;
        this.open = new Map();
        //----------------------------------------------------------
        // Internal functions
        //----------------------------------------------------------
        this.onConnect = function (context) {
            _this.connectionState.next(true);
        };
        this.onDisconnect = function (context) {
            _this.connectionState.next(false);
        };
        this.onServerSideMessage = function (context) {
            console.log('Publication from server-side channel', context);
        };
        var liveUrl = deps.appUrl.replace(/^http/, 'ws') + "/api/live/ws";
        this.centrifuge = new Centrifuge(liveUrl, {});
        this.centrifuge.setConnectData({
            sessionId: deps.sessionId,
            orgId: deps.orgId,
        });
        // orgRole is set when logged in *or* anonomus users can use grafana
        if (deps.liveEnabled && deps.orgRole !== '') {
            this.centrifuge.connect(); // do connection
        }
        this.connectionState = new BehaviorSubject(this.centrifuge.isConnected());
        this.connectionBlocker = new Promise(function (resolve) {
            if (_this.centrifuge.isConnected()) {
                return resolve();
            }
            var connectListener = function () {
                resolve();
                _this.centrifuge.removeListener('connect', connectListener);
            };
            _this.centrifuge.addListener('connect', connectListener);
        });
        // Register global listeners
        this.centrifuge.on('connect', this.onConnect);
        this.centrifuge.on('disconnect', this.onDisconnect);
        this.centrifuge.on('publish', this.onServerSideMessage);
    }
    /**
     * Get a channel.  If the scope, namespace, or path is invalid, a shutdown
     * channel will be returned with an error state indicated in its status
     */
    CentrifugeSrv.prototype.getChannel = function (addr, config) {
        var _this = this;
        var id = this.deps.orgId + "/" + addr.scope + "/" + addr.namespace + "/" + addr.path;
        var channel = this.open.get(id);
        if (channel != null) {
            return channel;
        }
        channel = new CentrifugeLiveChannel(id, addr);
        channel.shutdownCallback = function () {
            _this.open.delete(id); // remove it from the list of open channels
        };
        this.open.set(id, channel);
        // Initialize the channel in the background
        this.initChannel(config, channel).catch(function (err) {
            if (channel) {
                channel.currentStatus.state = LiveChannelConnectionState.Invalid;
                channel.shutdownWithError(err);
            }
            _this.open.delete(id);
        });
        // return the not-yet initalized channel
        return channel;
    };
    CentrifugeSrv.prototype.initChannel = function (config, channel) {
        return __awaiter(this, void 0, void 0, function () {
            var events;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        events = channel.initalize(config);
                        if (!!this.centrifuge.isConnected()) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.connectionBlocker];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        channel.subscription = this.centrifuge.subscribe(channel.id, events);
                        return [2 /*return*/];
                }
            });
        });
    };
    //----------------------------------------------------------
    // Exported functions
    //----------------------------------------------------------
    /**
     * Listen for changes to the connection state
     */
    CentrifugeSrv.prototype.getConnectionState = function () {
        return this.connectionState.asObservable();
    };
    /**
     * Watch for messages in a channel
     */
    CentrifugeSrv.prototype.getStream = function (address, config) {
        return this.getChannel(address, config).getStream();
    };
    /**
     * Connect to a channel and return results as DataFrames
     */
    CentrifugeSrv.prototype.getDataStream = function (options, config) {
        var _this = this;
        return new Observable(function (subscriber) {
            var _a;
            var channel = _this.getChannel(options.addr, config);
            var key = (_a = options.key) !== null && _a !== void 0 ? _a : "xstr/" + streamCounter++;
            var data = undefined;
            var filtered = undefined;
            var state = LoadingState.Streaming;
            var last = liveTimer.lastUpdate;
            var lastWidth = -1;
            var process = function (msg) {
                if (!data) {
                    data = new StreamingDataFrame(msg, options.buffer);
                }
                else {
                    data.push(msg);
                }
                state = LoadingState.Streaming;
                var sameWidth = lastWidth === data.fields.length;
                lastWidth = data.fields.length;
                // Filter out fields
                if (!filtered || msg.schema || !sameWidth) {
                    filtered = data;
                    if (options.filter) {
                        var fields_1 = options.filter.fields;
                        if (fields_1 === null || fields_1 === void 0 ? void 0 : fields_1.length) {
                            filtered = __assign(__assign({}, data), { fields: data.fields.filter(function (f) { return fields_1.includes(f.name); }) });
                        }
                    }
                }
                var elapsed = liveTimer.lastUpdate - last;
                if (elapsed > 1000 || liveTimer.ok) {
                    filtered.length = data.length; // make sure they stay up-to-date
                    subscriber.next({ state: state, data: [filtered], key: key });
                    last = liveTimer.lastUpdate;
                }
            };
            if (options.frame) {
                process(dataFrameToJSON(options.frame));
            }
            else if (channel.lastMessageWithSchema) {
                process(channel.lastMessageWithSchema);
            }
            var sub = channel.getStream().subscribe({
                error: function (err) {
                    console.log('LiveQuery [error]', { err: err }, options.addr);
                    state = LoadingState.Error;
                    subscriber.next({ state: state, data: [data], key: key, error: toDataQueryError(err) });
                    sub.unsubscribe(); // close after error
                },
                complete: function () {
                    console.log('LiveQuery [complete]', options.addr);
                    if (state !== LoadingState.Error) {
                        state = LoadingState.Done;
                    }
                    // or track errors? subscriber.next({ state, data: [data], key });
                    subscriber.complete();
                    sub.unsubscribe();
                },
                next: function (evt) {
                    if (isLiveChannelMessageEvent(evt)) {
                        process(evt.message);
                        return;
                    }
                    if (isLiveChannelStatusEvent(evt)) {
                        if (evt.error) {
                            var error = toDataQueryError(evt.error);
                            error.message = "Streaming channel error: " + error.message;
                            state = LoadingState.Error;
                            subscriber.next({ state: state, data: [data], key: key, error: error });
                            return;
                        }
                        else if (evt.state === LiveChannelConnectionState.Connected ||
                            evt.state === LiveChannelConnectionState.Pending) {
                            if (evt.message) {
                                process(evt.message);
                            }
                            return;
                        }
                        console.log('ignore state', evt);
                    }
                },
            });
            return function () {
                sub.unsubscribe();
            };
        });
    };
    /**
     * For channels that support presence, this will request the current state from the server.
     *
     * Join and leave messages will be sent to the open stream
     */
    CentrifugeSrv.prototype.getPresence = function (address, config) {
        return this.getChannel(address, config).getPresence();
    };
    return CentrifugeSrv;
}());
export { CentrifugeSrv };
// This is used to give a unique key for each stream.  The actual value does not matter
var streamCounter = 0;
//# sourceMappingURL=service.js.map