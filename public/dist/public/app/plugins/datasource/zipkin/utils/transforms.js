import { __assign, __read, __spreadArray, __values } from "tslib";
import { identity } from 'lodash';
import { FieldType, MutableDataFrame } from '@grafana/data';
/**
 * Transforms response to Grafana trace data frame.
 */
export function transformResponse(zSpans) {
    var e_1, _a;
    var spanRows = zSpans.map(transformSpan);
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
        ],
        meta: {
            preferredVisualisationType: 'trace',
            custom: {
                traceFormat: 'zipkin',
            },
        },
    });
    try {
        for (var spanRows_1 = __values(spanRows), spanRows_1_1 = spanRows_1.next(); !spanRows_1_1.done; spanRows_1_1 = spanRows_1.next()) {
            var span = spanRows_1_1.value;
            frame.add(span);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (spanRows_1_1 && !spanRows_1_1.done && (_a = spanRows_1.return)) _a.call(spanRows_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return frame;
}
function transformSpan(span) {
    var _a, _b, _c, _d, _e, _f;
    var row = {
        traceID: span.traceId,
        spanID: span.id,
        parentSpanID: span.parentId,
        operationName: span.name,
        serviceName: ((_a = span.localEndpoint) === null || _a === void 0 ? void 0 : _a.serviceName) || ((_b = span.remoteEndpoint) === null || _b === void 0 ? void 0 : _b.serviceName) || 'unknown',
        serviceTags: serviceTags(span),
        startTime: span.timestamp / 1000,
        duration: span.duration / 1000,
        logs: (_d = (_c = span.annotations) === null || _c === void 0 ? void 0 : _c.map(transformAnnotation)) !== null && _d !== void 0 ? _d : [],
        tags: Object.keys(span.tags || {}).reduce(function (acc, key) {
            // If tag is error we remap it to simple boolean so that the trace ui will show an error icon.
            if (key === 'error') {
                acc.push({
                    key: 'error',
                    value: true,
                });
                acc.push({
                    key: 'errorValue',
                    value: span.tags['error'],
                });
                return acc;
            }
            acc.push({ key: key, value: span.tags[key] });
            return acc;
        }, []),
    };
    if (span.kind) {
        row.tags = __spreadArray([
            {
                key: 'kind',
                value: span.kind,
            }
        ], __read(((_e = row.tags) !== null && _e !== void 0 ? _e : [])), false);
    }
    if (span.shared) {
        row.tags = __spreadArray([
            {
                key: 'shared',
                value: span.shared,
            }
        ], __read(((_f = row.tags) !== null && _f !== void 0 ? _f : [])), false);
    }
    return row;
}
/**
 * Maps annotations as a log as that seems to be the closest thing.
 * See https://zipkin.io/zipkin-api/#/default/get_trace__traceId_
 */
function transformAnnotation(annotation) {
    return {
        timestamp: annotation.timestamp,
        fields: [
            {
                key: 'annotation',
                value: annotation.value,
            },
        ],
    };
}
function serviceTags(span) {
    var endpoint = span.localEndpoint || span.remoteEndpoint;
    if (!endpoint) {
        return [];
    }
    return [
        valueToTag('ipv4', endpoint.ipv4),
        valueToTag('ipv6', endpoint.ipv6),
        valueToTag('port', endpoint.port),
        valueToTag('endpointType', span.localEndpoint ? 'local' : 'remote'),
    ].filter(identity);
}
function valueToTag(key, value) {
    if (!value) {
        return undefined;
    }
    return {
        key: key,
        value: value,
    };
}
/**
 * Transforms data frame to Zipkin response
 */
export var transformToZipkin = function (data) {
    var _a, _b;
    var response = [];
    var _loop_1 = function (i) {
        var span = data.get(i);
        response.push(__assign(__assign({ traceId: span.traceID, parentId: span.parentSpanID, name: span.operationName, id: span.spanID, timestamp: span.startTime * 1000, duration: span.duration * 1000 }, getEndpoint(span)), { annotations: span.logs.length
                ? span.logs.map(function (l) { return ({ timestamp: l.timestamp, value: l.fields[0].value }); })
                : undefined, tags: span.tags.length
                ? span.tags
                    .filter(function (t) { return t.key !== 'kind' && t.key !== 'endpointType' && t.key !== 'shared'; })
                    .reduce(function (tags, t) {
                    var _a, _b;
                    if (t.key === 'error') {
                        return __assign(__assign({}, tags), (_a = {}, _a[t.key] = span.tags.find(function (t) { return t.key === 'errorValue'; }).value || '', _a));
                    }
                    return __assign(__assign({}, tags), (_b = {}, _b[t.key] = t.value, _b));
                }, {})
                : undefined, kind: (_a = span.tags.find(function (t) { return t.key === 'kind'; })) === null || _a === void 0 ? void 0 : _a.value, shared: (_b = span.tags.find(function (t) { return t.key === 'shared'; })) === null || _b === void 0 ? void 0 : _b.value }));
    };
    for (var i = 0; i < data.length; i++) {
        _loop_1(i);
    }
    return response;
};
// Returns remote or local endpoint object
var getEndpoint = function (span) {
    var _a;
    var _b, _c, _d, _e;
    var key = ((_b = span.serviceTags.find(function (t) { return t.key === 'endpointType'; })) === null || _b === void 0 ? void 0 : _b.value) === 'local'
        ? 'localEndpoint'
        : 'remoteEndpoint';
    return span.serviceName !== 'unknown'
        ? (_a = {},
            _a[key] = {
                serviceName: span.serviceName,
                ipv4: (_c = span.serviceTags.find(function (t) { return t.key === 'ipv4'; })) === null || _c === void 0 ? void 0 : _c.value,
                ipv6: (_d = span.serviceTags.find(function (t) { return t.key === 'ipv6'; })) === null || _d === void 0 ? void 0 : _d.value,
                port: (_e = span.serviceTags.find(function (t) { return t.key === 'port'; })) === null || _e === void 0 ? void 0 : _e.value,
            },
            _a) : undefined;
};
//# sourceMappingURL=transforms.js.map