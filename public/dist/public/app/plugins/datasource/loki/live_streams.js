import { __assign } from "tslib";
import { FieldType, parseLabels, CircularDataFrame } from '@grafana/data';
import { throwError, timer } from 'rxjs';
import { webSocket } from 'rxjs/webSocket';
import { finalize, map, retryWhen, mergeMap } from 'rxjs/operators';
import { appendResponseToBufferedData } from './result_transformer';
/**
 * Cache of websocket streams that can be returned as observable. In case there already is a stream for particular
 * target it is returned and on subscription returns the latest dataFrame.
 */
var LiveStreams = /** @class */ (function () {
    function LiveStreams() {
        this.streams = {};
    }
    LiveStreams.prototype.getStream = function (target, retryInterval) {
        var _this = this;
        if (retryInterval === void 0) { retryInterval = 5000; }
        var stream = this.streams[target.url];
        if (stream) {
            return stream;
        }
        var data = new CircularDataFrame({ capacity: target.size });
        data.addField({ name: 'ts', type: FieldType.time, config: { displayName: 'Time' } });
        data.addField({ name: 'tsNs', type: FieldType.time, config: { displayName: 'Time ns' } });
        data.addField({ name: 'line', type: FieldType.string }).labels = parseLabels(target.query);
        data.addField({ name: 'labels', type: FieldType.other }); // The labels for each line
        data.addField({ name: 'id', type: FieldType.string });
        data.meta = __assign(__assign({}, data.meta), { preferredVisualisationType: 'logs' });
        data.refId = target.refId;
        stream = webSocket(target.url).pipe(map(function (response) {
            appendResponseToBufferedData(response, data);
            return [data];
        }), retryWhen(function (attempts) {
            return attempts.pipe(mergeMap(function (error, i) {
                var retryAttempt = i + 1;
                // Code 1006 is used to indicate that a connection was closed abnormally.
                // Added hard limit of 30 on number of retries.
                // If connection was closed abnormally, and we wish to retry, otherwise throw error.
                if (error.code === 1006 && retryAttempt < 30) {
                    if (retryAttempt > 10) {
                        // If more than 10 times retried, consol.warn, but keep reconnecting
                        console.warn("Websocket connection is being disrupted. We keep reconnecting but consider starting new live tailing again. Error: " + error.reason);
                    }
                    // Retry every 5s
                    return timer(retryInterval);
                }
                return throwError(error);
            }));
        }), finalize(function () {
            delete _this.streams[target.url];
        }));
        this.streams[target.url] = stream;
        return stream;
    };
    return LiveStreams;
}());
export { LiveStreams };
//# sourceMappingURL=live_streams.js.map