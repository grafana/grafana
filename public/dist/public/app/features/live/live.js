import { __awaiter } from "tslib";
import { from, map, of, switchMap } from 'rxjs';
import { toLiveChannelId, StreamingDataFrame } from '@grafana/data';
import { toDataQueryResponse } from '@grafana/runtime';
import { standardStreamOptionsProvider, toStreamingDataResponse, } from '@grafana/runtime/src/utils/DataSourceWithBackend';
import { isStreamingResponseData, StreamingResponseDataType } from './data/utils';
export class GrafanaLiveService {
    constructor(deps) {
        this.deps = deps;
        /**
         * Listen for changes to the connection state
         */
        this.getConnectionState = () => {
            return this.deps.centrifugeSrv.getConnectionState();
        };
        /**
         * Connect to a channel and return results as DataFrames
         */
        this.getDataStream = (options) => {
            let buffer;
            const updateBuffer = (next) => {
                const data = next.data[0];
                if (!buffer && !isStreamingResponseData(data, StreamingResponseDataType.FullFrame)) {
                    console.warn(`expected first packet to contain a full frame, received ${data === null || data === void 0 ? void 0 : data.type}`);
                    return;
                }
                switch (data.type) {
                    case StreamingResponseDataType.FullFrame: {
                        buffer = StreamingDataFrame.deserialize(data.frame);
                        return;
                    }
                    case StreamingResponseDataType.NewValuesSameSchema: {
                        buffer.pushNewValues(data.values);
                        return;
                    }
                }
            };
            return this.deps.centrifugeSrv.getDataStream(options).pipe(map((next) => {
                updateBuffer(next);
                return Object.assign(Object.assign({}, next), { data: [buffer !== null && buffer !== void 0 ? buffer : StreamingDataFrame.empty()] });
            }));
        };
        /**
         * Watch for messages in a channel
         */
        this.getStream = (address) => {
            return this.deps.centrifugeSrv.getStream(address);
        };
        /**
         * Execute a query over the live websocket and potentially subscribe to a live channel.
         *
         * Since the initial request and subscription are on the same socket, this will support HA setups
         */
        this.getQueryData = (options) => {
            return from(this.deps.centrifugeSrv.getQueryData(options)).pipe(switchMap((rawResponse) => {
                var _a;
                const parsedResponse = toDataQueryResponse(rawResponse, options.request.targets);
                const isSubscribable = ((_a = parsedResponse.data) === null || _a === void 0 ? void 0 : _a.length) && parsedResponse.data.find((f) => { var _a; return (_a = f.meta) === null || _a === void 0 ? void 0 : _a.channel; });
                return isSubscribable
                    ? toStreamingDataResponse(parsedResponse, options.request, standardStreamOptionsProvider)
                    : of(parsedResponse);
            }));
        };
        /**
         * Publish into a channel
         *
         * @alpha -- experimental
         */
        this.publish = (address, data) => __awaiter(this, void 0, void 0, function* () {
            return this.deps.backendSrv.post(`api/live/publish`, {
                channel: toLiveChannelId(address),
                data,
            });
        });
        /**
         * For channels that support presence, this will request the current state from the server.
         *
         * Join and leave messages will be sent to the open stream
         */
        this.getPresence = (address) => {
            return this.deps.centrifugeSrv.getPresence(address);
        };
    }
}
//# sourceMappingURL=live.js.map