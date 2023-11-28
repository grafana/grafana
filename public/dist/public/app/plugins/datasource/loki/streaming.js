import { __awaiter } from "tslib";
import { map, defer, mergeMap } from 'rxjs';
import { LiveChannelScope, LoadingState, StreamingDataFrame, } from '@grafana/data';
import { getGrafanaLiveSrv } from '@grafana/runtime';
/**
 * Calculate a unique key for the query.  The key is used to pick a channel and should
 * be unique for each distinct query execution plan.  This key is not secure and is only picked to avoid
 * possible collisions
 */
export function getLiveStreamKey(query) {
    return __awaiter(this, void 0, void 0, function* () {
        const str = JSON.stringify({ expr: query.expr });
        const msgUint8 = new TextEncoder().encode(str); // encode as (utf-8) Uint8Array
        const hashBuffer = yield crypto.subtle.digest('SHA-1', msgUint8); // hash the message
        const hashArray = Array.from(new Uint8Array(hashBuffer.slice(0, 8))); // first 8 bytes
        return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    });
}
// This will get both v1 and v2 result formats
export function doLokiChannelStream(query, ds, options) {
    var _a;
    // maximum time to keep values
    const range = options.range;
    const maxDelta = range.to.valueOf() - range.from.valueOf() + 1000;
    let maxLength = (_a = options.maxDataPoints) !== null && _a !== void 0 ? _a : 1000;
    if (maxLength > 100) {
        // for small buffers, keep them small
        maxLength *= 2;
    }
    let frame = undefined;
    const updateFrame = (msg) => {
        if (msg === null || msg === void 0 ? void 0 : msg.message) {
            const p = msg.message;
            if (!frame) {
                frame = StreamingDataFrame.fromDataFrameJSON(p, {
                    maxLength,
                    maxDelta,
                    displayNameFormat: query.legendFormat,
                });
            }
            else {
                frame.push(p);
            }
        }
        return frame;
    };
    return defer(() => getLiveStreamKey(query)).pipe(mergeMap((key) => {
        return getGrafanaLiveSrv()
            .getStream({
            scope: LiveChannelScope.DataSource,
            namespace: ds.uid,
            path: `tail/${key}`,
            data: Object.assign(Object.assign({}, query), { timeRange: {
                    from: range.from.valueOf().toString(),
                    to: range.to.valueOf().toString(),
                } }),
        })
            .pipe(map((evt) => {
            const frame = updateFrame(evt);
            return {
                data: frame ? [frame] : [],
                state: LoadingState.Streaming,
            };
        }));
    }));
}
//# sourceMappingURL=streaming.js.map