import { __assign, __read, __spreadArray, __values } from "tslib";
import { ArrayVector, FieldType, MutableDataFrame, } from '@grafana/data';
import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { collectorTypes } from '@opentelemetry/exporter-collector';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { createGraphFrames } from './graphTransform';
export function createTableFrame(logsFrame, datasourceUid, datasourceName, traceRegexs) {
    var e_1, _a, e_2, _b;
    var tableFrame = new MutableDataFrame({
        fields: [
            {
                name: 'Time',
                type: FieldType.time,
                config: {
                    custom: {
                        width: 150,
                    },
                },
            },
            {
                name: 'traceID',
                type: FieldType.string,
                config: {
                    displayNameFromDS: 'Trace ID',
                    custom: { width: 300 },
                    links: [
                        {
                            title: 'Click to open trace ${__value.raw}',
                            url: '',
                            internal: {
                                datasourceUid: datasourceUid,
                                datasourceName: datasourceName,
                                query: {
                                    query: '${__value.raw}',
                                },
                            },
                        },
                    ],
                },
            },
            {
                name: 'Message',
                type: FieldType.string,
            },
        ],
        meta: {
            preferredVisualisationType: 'table',
        },
    });
    if (!logsFrame || traceRegexs.length === 0) {
        return tableFrame;
    }
    var timeField = logsFrame.fields.find(function (f) { return f.type === FieldType.time; });
    try {
        // Going through all string fields to look for trace IDs
        for (var _c = __values(logsFrame.fields), _d = _c.next(); !_d.done; _d = _c.next()) {
            var field = _d.value;
            var hasMatch = false;
            if (field.type === FieldType.string) {
                var values = field.values.toArray();
                for (var i = 0; i < values.length; i++) {
                    var line = values[i];
                    if (line) {
                        try {
                            for (var traceRegexs_1 = (e_2 = void 0, __values(traceRegexs)), traceRegexs_1_1 = traceRegexs_1.next(); !traceRegexs_1_1.done; traceRegexs_1_1 = traceRegexs_1.next()) {
                                var traceRegex = traceRegexs_1_1.value;
                                var match = line.match(traceRegex);
                                if (match) {
                                    var traceId = match[1];
                                    var time = timeField ? timeField.values.get(i) : null;
                                    tableFrame.fields[0].values.add(time);
                                    tableFrame.fields[1].values.add(traceId);
                                    tableFrame.fields[2].values.add(line);
                                    hasMatch = true;
                                }
                            }
                        }
                        catch (e_2_1) { e_2 = { error: e_2_1 }; }
                        finally {
                            try {
                                if (traceRegexs_1_1 && !traceRegexs_1_1.done && (_b = traceRegexs_1.return)) _b.call(traceRegexs_1);
                            }
                            finally { if (e_2) throw e_2.error; }
                        }
                    }
                }
            }
            if (hasMatch) {
                break;
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return tableFrame;
}
export function transformTraceList(response, datasourceId, datasourceName, traceRegexs) {
    response.data.forEach(function (data, index) {
        var frame = createTableFrame(data, datasourceId, datasourceName, traceRegexs);
        response.data[index] = frame;
    });
    return response;
}
// Don't forget to change the backend code when the id representation changed
function transformBase64IDToHexString(base64) {
    var buffer = Buffer.from(base64, 'base64');
    var id = buffer.toString('hex');
    return id.length > 16 ? id.slice(16) : id;
}
function transformHexStringToBase64ID(hex) {
    var buffer = Buffer.from(hex, 'hex');
    var id = buffer.toString('base64');
    return id;
}
function getAttributeValue(value) {
    var e_3, _a;
    if (value.stringValue) {
        return value.stringValue;
    }
    if (value.boolValue !== undefined) {
        return Boolean(value.boolValue);
    }
    if (value.intValue !== undefined) {
        return Number.parseInt(value.intValue, 10);
    }
    if (value.doubleValue) {
        return Number.parseFloat(value.doubleValue);
    }
    if (value.arrayValue) {
        var arrayValue = [];
        try {
            for (var _b = __values(value.arrayValue.values), _c = _b.next(); !_c.done; _c = _b.next()) {
                var arValue = _c.value;
                arrayValue.push(getAttributeValue(arValue));
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_3) throw e_3.error; }
        }
        return arrayValue;
    }
    return '';
}
function resourceToProcess(resource) {
    var e_4, _a;
    var serviceTags = [];
    var serviceName = 'OTLPResourceNoServiceName';
    if (!resource) {
        return { serviceName: serviceName, serviceTags: serviceTags };
    }
    try {
        for (var _b = __values(resource.attributes), _c = _b.next(); !_c.done; _c = _b.next()) {
            var attribute = _c.value;
            if (attribute.key === SemanticResourceAttributes.SERVICE_NAME) {
                serviceName = attribute.value.stringValue || serviceName;
            }
            serviceTags.push({ key: attribute.key, value: getAttributeValue(attribute.value) });
        }
    }
    catch (e_4_1) { e_4 = { error: e_4_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_4) throw e_4.error; }
    }
    return { serviceName: serviceName, serviceTags: serviceTags };
}
function getSpanTags(span, instrumentationLibrary) {
    var e_5, _a;
    var spanTags = [];
    if (instrumentationLibrary) {
        if (instrumentationLibrary.name) {
            spanTags.push({ key: 'otel.library.name', value: instrumentationLibrary.name });
        }
        if (instrumentationLibrary.version) {
            spanTags.push({ key: 'otel.library.version', value: instrumentationLibrary.version });
        }
    }
    if (span.attributes) {
        try {
            for (var _b = __values(span.attributes), _c = _b.next(); !_c.done; _c = _b.next()) {
                var attribute = _c.value;
                spanTags.push({ key: attribute.key, value: getAttributeValue(attribute.value) });
            }
        }
        catch (e_5_1) { e_5 = { error: e_5_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_5) throw e_5.error; }
        }
    }
    if (span.status) {
        if (span.status.code && span.status.code !== SpanStatusCode.UNSET) {
            spanTags.push({
                key: 'otel.status_code',
                value: SpanStatusCode[span.status.code],
            });
            if (span.status.message) {
                spanTags.push({ key: 'otel.status_description', value: span.status.message });
            }
        }
        if (span.status.code === SpanStatusCode.ERROR) {
            spanTags.push({ key: 'error', value: true });
        }
    }
    if (span.kind !== undefined &&
        span.kind !== collectorTypes.opentelemetryProto.trace.v1.Span.SpanKind.SPAN_KIND_INTERNAL) {
        spanTags.push({
            key: 'span.kind',
            value: SpanKind[collectorTypes.opentelemetryProto.trace.v1.Span.SpanKind[span.kind]].toLowerCase(),
        });
    }
    return spanTags;
}
function getLogs(span) {
    var e_6, _a, e_7, _b;
    var logs = [];
    if (span.events) {
        try {
            for (var _c = __values(span.events), _d = _c.next(); !_d.done; _d = _c.next()) {
                var event_1 = _d.value;
                var fields = [];
                if (event_1.attributes) {
                    try {
                        for (var _e = (e_7 = void 0, __values(event_1.attributes)), _f = _e.next(); !_f.done; _f = _e.next()) {
                            var attribute = _f.value;
                            fields.push({ key: attribute.key, value: getAttributeValue(attribute.value) });
                        }
                    }
                    catch (e_7_1) { e_7 = { error: e_7_1 }; }
                    finally {
                        try {
                            if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                        }
                        finally { if (e_7) throw e_7.error; }
                    }
                }
                logs.push({ fields: fields, timestamp: event_1.timeUnixNano / 1000000 });
            }
        }
        catch (e_6_1) { e_6 = { error: e_6_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_6) throw e_6.error; }
        }
    }
    return logs;
}
export function transformFromOTLP(traceData, nodeGraph) {
    var e_8, _a, e_9, _b, e_10, _c;
    if (nodeGraph === void 0) { nodeGraph = false; }
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
                traceFormat: 'otlp',
            },
        },
    });
    try {
        try {
            for (var traceData_1 = __values(traceData), traceData_1_1 = traceData_1.next(); !traceData_1_1.done; traceData_1_1 = traceData_1.next()) {
                var data_1 = traceData_1_1.value;
                var _d = resourceToProcess(data_1.resource), serviceName = _d.serviceName, serviceTags = _d.serviceTags;
                try {
                    for (var _e = (e_9 = void 0, __values(data_1.instrumentationLibrarySpans)), _f = _e.next(); !_f.done; _f = _e.next()) {
                        var librarySpan = _f.value;
                        try {
                            for (var _g = (e_10 = void 0, __values(librarySpan.spans)), _h = _g.next(); !_h.done; _h = _g.next()) {
                                var span = _h.value;
                                frame.add({
                                    traceID: transformBase64IDToHexString(span.traceId),
                                    spanID: transformBase64IDToHexString(span.spanId),
                                    parentSpanID: transformBase64IDToHexString(span.parentSpanId || ''),
                                    operationName: span.name || '',
                                    serviceName: serviceName,
                                    serviceTags: serviceTags,
                                    startTime: span.startTimeUnixNano / 1000000,
                                    duration: (span.endTimeUnixNano - span.startTimeUnixNano) / 1000000,
                                    tags: getSpanTags(span, librarySpan.instrumentationLibrary),
                                    logs: getLogs(span),
                                });
                            }
                        }
                        catch (e_10_1) { e_10 = { error: e_10_1 }; }
                        finally {
                            try {
                                if (_h && !_h.done && (_c = _g.return)) _c.call(_g);
                            }
                            finally { if (e_10) throw e_10.error; }
                        }
                    }
                }
                catch (e_9_1) { e_9 = { error: e_9_1 }; }
                finally {
                    try {
                        if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                    }
                    finally { if (e_9) throw e_9.error; }
                }
            }
        }
        catch (e_8_1) { e_8 = { error: e_8_1 }; }
        finally {
            try {
                if (traceData_1_1 && !traceData_1_1.done && (_a = traceData_1.return)) _a.call(traceData_1);
            }
            finally { if (e_8) throw e_8.error; }
        }
    }
    catch (error) {
        return { error: { message: 'JSON is not valid OpenTelemetry format' }, data: [] };
    }
    var data = [frame];
    if (nodeGraph) {
        data.push.apply(data, __spreadArray([], __read(createGraphFrames(frame)), false));
    }
    return { data: data };
}
/**
 * Transforms trace dataframes to the OpenTelemetry format
 */
export function transformToOTLP(data) {
    var _a, _b;
    var result = {
        batches: [],
    };
    // Lookup object to see which batch contains spans for which services
    var services = {};
    for (var i = 0; i < data.length; i++) {
        var span = data.get(i);
        // Group spans based on service
        if (!services[span.serviceName]) {
            services[span.serviceName] = result.batches.length;
            result.batches.push({
                resource: {
                    attributes: [],
                    droppedAttributesCount: 0,
                },
                instrumentationLibrarySpans: [
                    {
                        spans: [],
                    },
                ],
            });
        }
        var batchIndex = services[span.serviceName];
        // Populate resource attributes from service tags
        if (result.batches[batchIndex].resource.attributes.length === 0) {
            result.batches[batchIndex].resource.attributes = tagsToAttributes(span.serviceTags);
        }
        // Populate instrumentation library if it exists
        if (!result.batches[batchIndex].instrumentationLibrarySpans[0].instrumentationLibrary) {
            var libraryName = (_a = span.tags.find(function (t) { return t.key === 'otel.library.name'; })) === null || _a === void 0 ? void 0 : _a.value;
            if (libraryName) {
                result.batches[batchIndex].instrumentationLibrarySpans[0].instrumentationLibrary = {
                    name: libraryName,
                    version: (_b = span.tags.find(function (t) { return t.key === 'otel.library.version'; })) === null || _b === void 0 ? void 0 : _b.value,
                };
            }
        }
        result.batches[batchIndex].instrumentationLibrarySpans[0].spans.push({
            traceId: transformHexStringToBase64ID(span.traceID.padStart(32, '0')),
            spanId: transformHexStringToBase64ID(span.spanID),
            traceState: '',
            parentSpanId: transformHexStringToBase64ID(span.parentSpanID || ''),
            name: span.operationName,
            kind: getOTLPSpanKind(span.tags),
            startTimeUnixNano: span.startTime * 1000000,
            endTimeUnixNano: (span.startTime + span.duration) * 1000000,
            attributes: tagsToAttributes(span.tags),
            droppedAttributesCount: 0,
            droppedEventsCount: 0,
            droppedLinksCount: 0,
            status: getOTLPStatus(span.tags),
            events: getOTLPEvents(span.logs),
        });
    }
    return result;
}
function getOTLPSpanKind(tags) {
    var _a;
    var spanKind = undefined;
    var spanKindTagValue = (_a = tags.find(function (t) { return t.key === 'span.kind'; })) === null || _a === void 0 ? void 0 : _a.value;
    switch (spanKindTagValue) {
        case 'server':
            spanKind = 'SPAN_KIND_SERVER';
            break;
        case 'client':
            spanKind = 'SPAN_KIND_CLIENT';
            break;
        case 'producer':
            spanKind = 'SPAN_KIND_PRODUCER';
            break;
        case 'consumer':
            spanKind = 'SPAN_KIND_CONSUMER';
            break;
    }
    return spanKind;
}
/**
 * Converts key-value tags to OTLP attributes and removes tags added by Grafana
 */
function tagsToAttributes(tags) {
    return tags
        .filter(function (t) {
        return ![
            'span.kind',
            'otel.library.name',
            'otel.libary.version',
            'otel.status_description',
            'otel.status_code',
        ].includes(t.key);
    })
        .reduce(function (attributes, tag) { return __spreadArray(__spreadArray([], __read(attributes), false), [{ key: tag.key, value: toAttributeValue(tag) }], false); }, []);
}
/**
 * Returns the correct OTLP AnyValue based on the value of the tag value
 */
function toAttributeValue(tag) {
    var e_11, _a;
    if (typeof tag.value === 'string') {
        return { stringValue: tag.value };
    }
    else if (typeof tag.value === 'boolean') {
        return { boolValue: tag.value };
    }
    else if (typeof tag.value === 'number') {
        if (tag.value % 1 === 0) {
            return { intValue: tag.value };
        }
        else {
            return { doubleValue: tag.value };
        }
    }
    else if (typeof tag.value === 'object') {
        if (Array.isArray(tag.value)) {
            var values = [];
            try {
                for (var _b = __values(tag.value), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var val = _c.value;
                    values.push(toAttributeValue(val));
                }
            }
            catch (e_11_1) { e_11 = { error: e_11_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_11) throw e_11.error; }
            }
            return { arrayValue: { values: values } };
        }
    }
    return { stringValue: tag.value };
}
function getOTLPStatus(tags) {
    var _a;
    var status = undefined;
    var statusCodeTag = tags.find(function (t) { return t.key === 'otel.status_code'; });
    if (statusCodeTag) {
        status = {
            code: statusCodeTag.value,
            message: (_a = tags.find(function (t) { return t.key === 'otel_status_description'; })) === null || _a === void 0 ? void 0 : _a.value,
        };
    }
    return status;
}
function getOTLPEvents(logs) {
    var e_12, _a, e_13, _b;
    if (!logs || !logs.length) {
        return undefined;
    }
    var events = [];
    try {
        for (var logs_1 = __values(logs), logs_1_1 = logs_1.next(); !logs_1_1.done; logs_1_1 = logs_1.next()) {
            var log = logs_1_1.value;
            var event_2 = {
                timeUnixNano: log.timestamp * 1000000,
                attributes: [],
                droppedAttributesCount: 0,
                name: '',
            };
            try {
                for (var _c = (e_13 = void 0, __values(log.fields)), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var field = _d.value;
                    event_2.attributes.push({
                        key: field.key,
                        value: toAttributeValue(field),
                    });
                }
            }
            catch (e_13_1) { e_13 = { error: e_13_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_b = _c.return)) _b.call(_c);
                }
                finally { if (e_13) throw e_13.error; }
            }
            events.push(event_2);
        }
    }
    catch (e_12_1) { e_12 = { error: e_12_1 }; }
    finally {
        try {
            if (logs_1_1 && !logs_1_1.done && (_a = logs_1.return)) _a.call(logs_1);
        }
        finally { if (e_12) throw e_12.error; }
    }
    return events;
}
export function transformTrace(response, nodeGraph) {
    if (nodeGraph === void 0) { nodeGraph = false; }
    // We need to parse some of the fields which contain stringified json.
    // Seems like we can't just map the values as the frame we got from backend has some default processing
    // and will stringify the json back when we try to set it. So we create a new field and swap it instead.
    var frame = response.data[0];
    if (!frame) {
        return emptyDataQueryResponse;
    }
    parseJsonFields(frame);
    var data = __spreadArray([], __read(response.data), false);
    if (nodeGraph) {
        data.push.apply(data, __spreadArray([], __read(createGraphFrames(frame)), false));
    }
    return __assign(__assign({}, response), { data: data });
}
/**
 * Change fields which are json string into JS objects. Modifies the frame in place.
 */
function parseJsonFields(frame) {
    var e_14, _a;
    var _loop_1 = function (fieldName) {
        var field = frame.fields.find(function (f) { return f.name === fieldName; });
        if (field) {
            var fieldIndex = frame.fields.indexOf(field);
            var values = new ArrayVector();
            var newField = __assign(__assign({}, field), { values: values, type: FieldType.other });
            for (var i = 0; i < field.values.length; i++) {
                var value = field.values.get(i);
                values.set(i, value === '' ? undefined : JSON.parse(value));
            }
            frame.fields[fieldIndex] = newField;
        }
    };
    try {
        for (var _b = __values(['serviceTags', 'logs', 'tags']), _c = _b.next(); !_c.done; _c = _b.next()) {
            var fieldName = _c.value;
            _loop_1(fieldName);
        }
    }
    catch (e_14_1) { e_14 = { error: e_14_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_14) throw e_14.error; }
    }
}
export function createTableFrameFromSearch(data, instanceSettings) {
    var e_15, _a;
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
                                    queryType: 'traceId',
                                },
                            },
                        },
                    ],
                },
            },
            { name: 'traceName', type: FieldType.string, config: { displayNameFromDS: 'Trace name' } },
            { name: 'startTime', type: FieldType.time, config: { displayNameFromDS: 'Start time' } },
            { name: 'duration', type: FieldType.number, config: { displayNameFromDS: 'Duration', unit: 'ms' } },
        ],
        meta: {
            preferredVisualisationType: 'table',
        },
    });
    if (!(data === null || data === void 0 ? void 0 : data.length)) {
        return frame;
    }
    // Show the most recent traces
    var traceData = data.map(transformToTraceData).sort(function (a, b) { return (b === null || b === void 0 ? void 0 : b.startTime) - (a === null || a === void 0 ? void 0 : a.startTime); });
    try {
        for (var traceData_2 = __values(traceData), traceData_2_1 = traceData_2.next(); !traceData_2_1.done; traceData_2_1 = traceData_2.next()) {
            var trace = traceData_2_1.value;
            frame.add(trace);
        }
    }
    catch (e_15_1) { e_15 = { error: e_15_1 }; }
    finally {
        try {
            if (traceData_2_1 && !traceData_2_1.done && (_a = traceData_2.return)) _a.call(traceData_2);
        }
        finally { if (e_15) throw e_15.error; }
    }
    return frame;
}
function transformToTraceData(data) {
    var traceName = '';
    if (data.rootServiceName) {
        traceName += data.rootServiceName + ' ';
    }
    if (data.rootTraceName) {
        traceName += data.rootTraceName;
    }
    return {
        traceID: data.traceID,
        startTime: parseInt(data.startTimeUnixNano, 10) / 1000 / 1000,
        duration: data.durationMs,
        traceName: traceName,
    };
}
var emptyDataQueryResponse = {
    data: [
        new MutableDataFrame({
            fields: [
                {
                    name: 'trace',
                    type: FieldType.trace,
                    values: [],
                },
            ],
            meta: {
                preferredVisualisationType: 'trace',
                custom: {
                    traceFormat: 'otlp',
                },
            },
        }),
    ],
};
//# sourceMappingURL=resultTransformer.js.map