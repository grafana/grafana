import { __awaiter, __generator } from "tslib";
import { mergeMap, from, of } from 'rxjs';
import { isValidLiveChannelAddress, LiveChannelConnectionState, LiveChannelEventType, LoadingState, toLiveChannelId, } from '@grafana/data';
import { catchError } from 'rxjs/operators';
var GrafanaLiveService = /** @class */ (function () {
    function GrafanaLiveService(deps) {
        this.deps = deps;
        this.getInvalidChannelStream = function (error, address) {
            return of({
                type: LiveChannelEventType.Status,
                id: address.scope + "/" + address.namespace + "/" + address.path,
                timestamp: Date.now(),
                state: LiveChannelConnectionState.Invalid,
                error: error,
                message: error.message,
            });
        };
        this.getInvalidDataStream = function (error, options) {
            return of({
                error: {
                    data: {
                        error: error.stack,
                    },
                    message: error.message,
                },
                state: LoadingState.Error,
                data: options.frame ? [options.frame] : [],
            });
        };
    }
    /**
     * Listen for changes to the connection state
     */
    GrafanaLiveService.prototype.getConnectionState = function () {
        return this.deps.centrifugeSrv.getConnectionState();
    };
    /**
     * Connect to a channel and return results as DataFrames
     */
    GrafanaLiveService.prototype.getDataStream = function (options) {
        var _this = this;
        var channelConfig = this.getChannelInfo(options.addr);
        return from(channelConfig).pipe(mergeMap(function (config) { return _this.deps.centrifugeSrv.getDataStream(options, config); }), catchError(function (error) { return _this.getInvalidDataStream(error, options); }));
    };
    /**
     * Watch for messages in a channel
     */
    GrafanaLiveService.prototype.getStream = function (address) {
        var _this = this;
        var channelConfig = this.getChannelInfo(address);
        return from(channelConfig).pipe(mergeMap(function (config) { return _this.deps.centrifugeSrv.getStream(address, config); }), catchError(function (error) { return _this.getInvalidChannelStream(error, address); }));
    };
    /**
     * Publish into a channel
     *
     * @alpha -- experimental
     */
    GrafanaLiveService.prototype.publish = function (address, data) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.deps.backendSrv.post("api/live/publish", {
                        channel: toLiveChannelId(address),
                        data: data,
                    })];
            });
        });
    };
    /**
     * For channels that support presence, this will request the current state from the server.
     *
     * Join and leave messages will be sent to the open stream
     */
    GrafanaLiveService.prototype.getPresence = function (address) {
        return __awaiter(this, void 0, void 0, function () {
            var channelConfig;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getChannelInfo(address)];
                    case 1:
                        channelConfig = _a.sent();
                        return [2 /*return*/, this.deps.centrifugeSrv.getPresence(address, channelConfig)];
                }
            });
        });
    };
    /**
     * Get a channel.  If the scope, namespace, or path is invalid, a shutdown
     * channel will be returned with an error state indicated in its status.
     *
     * This is a singleton instance that stays active until explicitly shutdown.
     * Multiple requests for this channel will return the same object until
     * the channel is shutdown
     */
    GrafanaLiveService.prototype.getChannelInfo = function (addr) {
        return __awaiter(this, void 0, void 0, function () {
            var support;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!isValidLiveChannelAddress(addr)) {
                            return [2 /*return*/, Promise.reject('invalid live channel address')];
                        }
                        if (!this.deps.scopes.doesScopeExist(addr.scope)) {
                            return [2 /*return*/, Promise.reject('invalid scope')];
                        }
                        return [4 /*yield*/, this.deps.scopes.getChannelSupport(addr.scope, addr.namespace)];
                    case 1:
                        support = _a.sent();
                        if (!support) {
                            return [2 /*return*/, Promise.reject(addr.namespace + ' does not support streaming')];
                        }
                        return [2 /*return*/, support.getChannelConfig(addr.path)];
                }
            });
        });
    };
    return GrafanaLiveService;
}());
export { GrafanaLiveService };
//# sourceMappingURL=live.js.map