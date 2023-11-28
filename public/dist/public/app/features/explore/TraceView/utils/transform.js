import { DataFrameView } from '@grafana/data';
import { transformTraceData } from '../components';
export function transformDataFrames(frame) {
    if (!frame) {
        return null;
    }
    let data = frame.fields.length === 1
        ? // For backward compatibility when we sent whole json response in a single field/value
            frame.fields[0].values[0]
        : transformTraceDataFrame(frame);
    return transformTraceData(data);
}
function transformTraceDataFrame(frame) {
    const view = new DataFrameView(frame);
    const processes = {};
    for (let i = 0; i < view.length; i++) {
        const span = view.get(i);
        if (!processes[span.spanID]) {
            processes[span.spanID] = {
                serviceName: span.serviceName,
                tags: span.serviceTags,
            };
        }
    }
    return {
        traceID: view.get(0).traceID,
        processes,
        spans: view.toArray().map((s, index) => {
            var _a;
            const references = [];
            if (s.parentSpanID) {
                references.push({ refType: 'CHILD_OF', spanID: s.parentSpanID, traceID: s.traceID });
            }
            if (s.references) {
                references.push(...s.references.map((reference) => (Object.assign({ refType: 'FOLLOWS_FROM' }, reference))));
            }
            return Object.assign(Object.assign({}, s), { duration: s.duration * 1000, startTime: s.startTime * 1000, processID: s.spanID, flags: 0, references, logs: ((_a = s.logs) === null || _a === void 0 ? void 0 : _a.map((l) => (Object.assign(Object.assign({}, l), { timestamp: l.timestamp * 1000 })))) || [], dataFrameRowIndex: index });
        }),
    };
}
//# sourceMappingURL=transform.js.map