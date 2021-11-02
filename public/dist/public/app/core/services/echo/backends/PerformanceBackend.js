import { EchoEventType } from '@grafana/runtime';
import { backendSrv } from '../../backend_srv';
/**
 * Echo's performance metrics consumer
 * Reports performance metrics to given url (TODO)
 */
var PerformanceBackend = /** @class */ (function () {
    function PerformanceBackend(options) {
        var _this = this;
        this.options = options;
        this.buffer = [];
        this.supportedEvents = [EchoEventType.Performance];
        this.addEvent = function (e) {
            _this.buffer.push(e.payload);
        };
        this.flush = function () {
            if (_this.buffer.length === 0) {
                return;
            }
            // Currently we don't have an API for sending the metrics hence logging to console in dev environment
            if (process.env.NODE_ENV === 'development') {
                console.log('PerformanceBackend flushing:', _this.buffer);
            }
            backendSrv.post('/api/frontend-metrics', {
                events: _this.buffer,
            });
            _this.buffer = [];
        };
    }
    return PerformanceBackend;
}());
export { PerformanceBackend };
//# sourceMappingURL=PerformanceBackend.js.map