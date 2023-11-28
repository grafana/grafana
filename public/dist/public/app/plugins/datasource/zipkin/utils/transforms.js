import { FieldType, MutableDataFrame } from '@grafana/data';
/**
 * Transforms response to Grafana trace data frame.
 */
export function transformResponse(zSpans) {
    const spanRows = zSpans.map(transformSpan);
    const frame = new MutableDataFrame({
        fields: [
            { name: 'traceID', type: FieldType.string, values: [] },
            { name: 'spanID', type: FieldType.string, values: [] },
            { name: 'parentSpanID', type: FieldType.string, values: [] },
            { name: 'operationName', type: FieldType.string, values: [] },
            { name: 'serviceName', type: FieldType.string, values: [] },
            { name: 'serviceTags', type: FieldType.other, values: [] },
            { name: 'startTime', type: FieldType.number, values: [] },
            { name: 'duration', type: FieldType.number, values: [] },
            { name: 'logs', type: FieldType.other, values: [] },
            { name: 'tags', type: FieldType.other, values: [] },
        ],
        meta: {
            preferredVisualisationType: 'trace',
            custom: {
                traceFormat: 'zipkin',
            },
        },
    });
    for (const span of spanRows) {
        frame.add(span);
    }
    return frame;
}
function transformSpan(span) {
    var _a, _b, _c, _d, _e, _f;
    const row = {
        traceID: span.traceId,
        spanID: span.id,
        parentSpanID: span.parentId,
        operationName: span.name,
        serviceName: ((_a = span.localEndpoint) === null || _a === void 0 ? void 0 : _a.serviceName) || ((_b = span.remoteEndpoint) === null || _b === void 0 ? void 0 : _b.serviceName) || 'unknown',
        serviceTags: serviceTags(span),
        startTime: span.timestamp / 1000,
        duration: span.duration / 1000,
        logs: (_d = (_c = span.annotations) === null || _c === void 0 ? void 0 : _c.map(transformAnnotation)) !== null && _d !== void 0 ? _d : [],
        tags: Object.keys(span.tags || {}).reduce((acc, key) => {
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
            acc.push({ key, value: span.tags[key] });
            return acc;
        }, []),
    };
    if (span.kind) {
        row.tags = [
            {
                key: 'kind',
                value: span.kind,
            },
            ...((_e = row.tags) !== null && _e !== void 0 ? _e : []),
        ];
    }
    if (span.shared) {
        row.tags = [
            {
                key: 'shared',
                value: span.shared,
            },
            ...((_f = row.tags) !== null && _f !== void 0 ? _f : []),
        ];
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
    const endpoint = span.localEndpoint || span.remoteEndpoint;
    if (!endpoint) {
        return [];
    }
    return [
        valueToTag('ipv4', endpoint.ipv4),
        valueToTag('ipv6', endpoint.ipv6),
        valueToTag('port', endpoint.port),
        valueToTag('endpointType', span.localEndpoint ? 'local' : 'remote'),
    ].filter((item) => Boolean(item));
}
function valueToTag(key, value) {
    if (!value) {
        return undefined;
    }
    return {
        key,
        value,
    };
}
/**
 * Transforms data frame to Zipkin response
 */
export const transformToZipkin = (data) => {
    var _a, _b;
    let response = [];
    for (let i = 0; i < data.length; i++) {
        const span = data.get(i);
        response.push(Object.assign(Object.assign({ traceId: span.traceID, parentId: span.parentSpanID, name: span.operationName, id: span.spanID, timestamp: span.startTime * 1000, duration: span.duration * 1000 }, getEndpoint(span)), { annotations: span.logs.length
                ? span.logs.map((l) => ({ timestamp: l.timestamp, value: l.fields[0].value }))
                : undefined, tags: span.tags.length
                ? span.tags
                    .filter((t) => t.key !== 'kind' && t.key !== 'endpointType' && t.key !== 'shared')
                    .reduce((tags, t) => {
                    if (t.key === 'error') {
                        return Object.assign(Object.assign({}, tags), { [t.key]: span.tags.find((t) => t.key === 'errorValue').value || '' });
                    }
                    return Object.assign(Object.assign({}, tags), { [t.key]: t.value });
                }, {})
                : undefined, kind: (_a = span.tags.find((t) => t.key === 'kind')) === null || _a === void 0 ? void 0 : _a.value, shared: (_b = span.tags.find((t) => t.key === 'shared')) === null || _b === void 0 ? void 0 : _b.value }));
    }
    return response;
};
// Returns remote or local endpoint object
const getEndpoint = (span) => {
    var _a, _b, _c, _d;
    const key = ((_a = span.serviceTags.find((t) => t.key === 'endpointType')) === null || _a === void 0 ? void 0 : _a.value) === 'local'
        ? 'localEndpoint'
        : 'remoteEndpoint';
    return span.serviceName !== 'unknown'
        ? {
            [key]: {
                serviceName: span.serviceName,
                ipv4: (_b = span.serviceTags.find((t) => t.key === 'ipv4')) === null || _b === void 0 ? void 0 : _b.value,
                ipv6: (_c = span.serviceTags.find((t) => t.key === 'ipv6')) === null || _c === void 0 ? void 0 : _c.value,
                port: (_d = span.serviceTags.find((t) => t.key === 'port')) === null || _d === void 0 ? void 0 : _d.value,
            },
        }
        : undefined;
};
//# sourceMappingURL=transforms.js.map