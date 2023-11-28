import { EchoEventType } from '@grafana/runtime';
import { backendSrv } from '../../backend_srv';
/**
 * Echo's performance metrics consumer
 * Reports performance metrics to given url (TODO)
 */
export class PerformanceBackend {
    constructor(options) {
        this.options = options;
        this.buffer = [];
        this.supportedEvents = [EchoEventType.Performance];
        this.addEvent = (e) => {
            this.buffer.push(e.payload);
        };
        this.flush = () => {
            if (this.buffer.length === 0) {
                return;
            }
            backendSrv.post('/api/frontend-metrics', {
                events: this.buffer,
            });
            this.buffer = [];
        };
    }
}
//# sourceMappingURL=PerformanceBackend.js.map