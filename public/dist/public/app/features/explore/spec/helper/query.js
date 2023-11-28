import { from } from 'rxjs';
import { ArrayDataFrame, FieldType } from '@grafana/data';
export function makeLogsQueryResponse(marker = '') {
    const df = new ArrayDataFrame([{ ts: Date.now(), line: `custom log line ${marker}` }]);
    df.meta = {
        preferredVisualisationType: 'logs',
    };
    df.fields[0].type = FieldType.time;
    return from([{ data: [df] }]);
}
export function makeMetricsQueryResponse() {
    const df = new ArrayDataFrame([{ ts: Date.now(), val: 1 }]);
    df.fields[0].type = FieldType.time;
    return from([{ data: [df] }]);
}
//# sourceMappingURL=query.js.map