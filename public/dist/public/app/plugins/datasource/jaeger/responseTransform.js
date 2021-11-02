import { __assign, __values } from "tslib";
import { FieldType, MutableDataFrame, } from '@grafana/data';
import { transformTraceData } from '@jaegertracing/jaeger-ui-components';
export function createTraceFrame(data) {
    var e_1, _a;
    var spans = data.spans.map(function (s) { return toSpanRow(s, data.processes); });
    var frame = new MutableDataFrame({
        fields: [
            { name: 'traceID', type: FieldType.string },
            { name: 'spanID', type: FieldType.string },
            { name: 'parentSpanID', type: FieldType.string },
            { name: 'operationName', type: FieldType.string },
            { name: 'serviceName', type: FieldType.string },
            { name: 'serviceTags', type: FieldType.other },
            { name: 'startTime', type: FieldType.number },
            { name: 'duration', type: FieldType.number },
            { name: 'logs', type: FieldType.other },
            { name: 'tags', type: FieldType.other },
            { name: 'warnings', type: FieldType.other },
            { name: 'stackTraces', type: FieldType.other },
        ],
        meta: {
            preferredVisualisationType: 'trace',
            custom: {
                traceFormat: 'jaeger',
            },
        },
    });
    try {
        for (var spans_1 = __values(spans), spans_1_1 = spans_1.next(); !spans_1_1.done; spans_1_1 = spans_1.next()) {
            var span = spans_1_1.value;
            frame.add(span);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (spans_1_1 && !spans_1_1.done && (_a = spans_1.return)) _a.call(spans_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return frame;
}
function toSpanRow(span, processes) {
    var _a, _b, _c;
    return {
        spanID: span.spanID,
        traceID: span.traceID,
        parentSpanID: (_b = (_a = span.references) === null || _a === void 0 ? void 0 : _a.find(function (r) { return r.refType === 'CHILD_OF'; })) === null || _b === void 0 ? void 0 : _b.spanID,
        operationName: span.operationName,
        // from micro to millis
        startTime: span.startTime / 1000,
        duration: span.duration / 1000,
        logs: span.logs.map(function (l) { return (__assign(__assign({}, l), { timestamp: l.timestamp / 1000 })); }),
        tags: span.tags,
        warnings: (_c = span.warnings) !== null && _c !== void 0 ? _c : undefined,
        stackTraces: span.stackTraces,
        serviceName: processes[span.processID].serviceName,
        serviceTags: processes[span.processID].tags,
    };
}
export function createTableFrame(data, instanceSettings) {
    var e_2, _a;
    var frame = new MutableDataFrame({
        fields: [
            {
                name: 'traceID',
                type: FieldType.string,
                config: {
                    displayNameFromDS: 'Trace ID',
                    links: [
                        {
                            title: 'Trace: ${__value.raw}',
                            url: '',
                            internal: {
                                datasourceUid: instanceSettings.uid,
                                datasourceName: instanceSettings.name,
                                query: {
                                    query: '${__value.raw}',
                                },
                            },
                        },
                    ],
                },
            },
            { name: 'traceName', type: FieldType.string, config: { displayNameFromDS: 'Trace name' } },
            { name: 'startTime', type: FieldType.time, config: { displayNameFromDS: 'Start time' } },
            { name: 'duration', type: FieldType.number, config: { displayNameFromDS: 'Duration', unit: 'µs' } },
        ],
        meta: {
            preferredVisualisationType: 'table',
        },
    });
    // Show the most recent traces
    var traceData = data.map(transformToTraceData).sort(function (a, b) { return (b === null || b === void 0 ? void 0 : b.startTime) - (a === null || a === void 0 ? void 0 : a.startTime); });
    try {
        for (var traceData_1 = __values(traceData), traceData_1_1 = traceData_1.next(); !traceData_1_1.done; traceData_1_1 = traceData_1.next()) {
            var trace = traceData_1_1.value;
            frame.add(trace);
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (traceData_1_1 && !traceData_1_1.done && (_a = traceData_1.return)) _a.call(traceData_1);
        }
        finally { if (e_2) throw e_2.error; }
    }
    return frame;
}
function transformToTraceData(data) {
    var traceData = transformTraceData(data);
    if (!traceData) {
        return;
    }
    return {
        traceID: traceData.traceID,
        startTime: traceData.startTime / 1000,
        duration: traceData.duration,
        traceName: traceData.traceName,
    };
}
export function transformToJaeger(data) {
    var traceResponse = {
        traceID: '',
        spans: [],
        processes: {},
        warnings: null,
    };
    var processes = [];
    var _loop_1 = function (i) {
        var span = data.get(i);
        // Set traceID
        if (!traceResponse.traceID) {
            traceResponse.traceID = span.traceID;
        }
        // Create process if doesn't exist
        if (!processes.find(function (p) { return p === span.serviceName; })) {
            processes.push(span.serviceName);
            traceResponse.processes["p" + processes.length] = {
                serviceName: span.serviceName,
                tags: span.serviceTags,
            };
        }
        // Create span
        traceResponse.spans.push({
            traceID: span.traceID,
            spanID: span.spanID,
            duration: span.duration * 1000,
            references: span.parentSpanID
                ? [
                    {
                        refType: 'CHILD_OF',
                        spanID: span.parentSpanID,
                        traceID: span.traceID,
                    },
                ]
                : [],
            flags: 0,
            logs: span.logs.map(function (l) { return (__assign(__assign({}, l), { timestamp: l.timestamp * 1000 })); }),
            operationName: span.operationName,
            processID: Object.keys(traceResponse.processes).find(function (key) { return traceResponse.processes[key].serviceName === span.serviceName; }) || '',
            startTime: span.startTime * 1000,
            tags: span.tags,
            warnings: span.warnings ? span.warnings : null,
        });
    };
    for (var i = 0; i < data.length; i++) {
        _loop_1(i);
    }
    return { data: [traceResponse], total: 0, limit: 0, offset: 0, errors: null };
}
//# sourceMappingURL=responseTransform.js.map