import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { FieldType, MutableDataFrame, createDataFrame, getDisplayProcessor, createTheme, toDataFrame, } from '@grafana/data';
import { SearchTableType } from './dataquery.gen';
import { createGraphFrames } from './graphTransform';
export function createTableFrame(logsFrame, datasourceUid, datasourceName, traceRegexs) {
    const tableFrame = new MutableDataFrame({
        fields: [
            {
                name: 'Time',
                type: FieldType.time,
                config: {
                    custom: {
                        width: 200,
                    },
                },
                values: [],
            },
            {
                name: 'traceID',
                type: FieldType.string,
                config: {
                    displayNameFromDS: 'Trace ID',
                    custom: { width: 180 },
                    links: [
                        {
                            title: 'Click to open trace ${__value.raw}',
                            url: '',
                            internal: {
                                datasourceUid,
                                datasourceName,
                                query: {
                                    query: '${__value.raw}',
                                },
                            },
                        },
                    ],
                },
                values: [],
            },
            {
                name: 'Message',
                type: FieldType.string,
                values: [],
            },
        ],
        meta: {
            preferredVisualisationType: 'table',
        },
    });
    if (!logsFrame || traceRegexs.length === 0) {
        return tableFrame;
    }
    const timeField = logsFrame.fields.find((f) => f.type === FieldType.time);
    // Going through all string fields to look for trace IDs
    for (let field of logsFrame.fields) {
        let hasMatch = false;
        if (field.type === FieldType.string) {
            const values = field.values;
            for (let i = 0; i < values.length; i++) {
                const line = values[i];
                if (line) {
                    for (let traceRegex of traceRegexs) {
                        const match = line.match(traceRegex);
                        if (match) {
                            const traceId = match[1];
                            const time = timeField ? timeField.values[i] : null;
                            tableFrame.fields[0].values.push(time);
                            tableFrame.fields[1].values.push(traceId);
                            tableFrame.fields[2].values.push(line);
                            hasMatch = true;
                        }
                    }
                }
            }
        }
        if (hasMatch) {
            break;
        }
    }
    return tableFrame;
}
export function transformTraceList(response, datasourceId, datasourceName, traceRegexs) {
    response.data.forEach((data, index) => {
        const frame = createTableFrame(data, datasourceId, datasourceName, traceRegexs);
        response.data[index] = frame;
    });
    return response;
}
function getAttributeValue(value) {
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
        const arrayValue = [];
        for (const arValue of value.arrayValue.values) {
            arrayValue.push(getAttributeValue(arValue));
        }
        return arrayValue;
    }
    return '';
}
function resourceToProcess(resource) {
    const serviceTags = [];
    let serviceName = 'OTLPResourceNoServiceName';
    if (!resource) {
        return { serviceName, serviceTags };
    }
    for (const attribute of resource.attributes) {
        if (attribute.key === SemanticResourceAttributes.SERVICE_NAME) {
            serviceName = attribute.value.stringValue || serviceName;
        }
        serviceTags.push({ key: attribute.key, value: getAttributeValue(attribute.value) });
    }
    return { serviceName, serviceTags };
}
function getSpanTags(span) {
    const spanTags = [];
    if (span.attributes) {
        for (const attribute of span.attributes) {
            spanTags.push({ key: attribute.key, value: getAttributeValue(attribute.value) });
        }
    }
    return spanTags;
}
function getSpanKind(span) {
    let kind = undefined;
    if (span.kind) {
        const split = span.kind.toString().toLowerCase().split('_');
        kind = split.length ? split[split.length - 1] : span.kind.toString();
    }
    return kind;
}
function getReferences(span) {
    const references = [];
    if (span.links) {
        for (const link of span.links) {
            const { traceId, spanId } = link;
            const tags = [];
            if (link.attributes) {
                for (const attribute of link.attributes) {
                    tags.push({ key: attribute.key, value: getAttributeValue(attribute.value) });
                }
            }
            references.push({ traceID: traceId, spanID: spanId, tags });
        }
    }
    return references;
}
function getLogs(span) {
    const logs = [];
    if (span.events) {
        for (const event of span.events) {
            const fields = [];
            if (event.attributes) {
                for (const attribute of event.attributes) {
                    fields.push({ key: attribute.key, value: getAttributeValue(attribute.value) });
                }
            }
            logs.push({ fields, timestamp: event.timeUnixNano / 1000000 });
        }
    }
    return logs;
}
export function transformFromOTLP(traceData, nodeGraph = false) {
    var _a, _b, _c, _d;
    const frame = new MutableDataFrame({
        fields: [
            { name: 'traceID', type: FieldType.string, values: [] },
            { name: 'spanID', type: FieldType.string, values: [] },
            { name: 'parentSpanID', type: FieldType.string, values: [] },
            { name: 'operationName', type: FieldType.string, values: [] },
            { name: 'serviceName', type: FieldType.string, values: [] },
            { name: 'kind', type: FieldType.string, values: [] },
            { name: 'statusCode', type: FieldType.number, values: [] },
            { name: 'statusMessage', type: FieldType.string, values: [] },
            { name: 'instrumentationLibraryName', type: FieldType.string, values: [] },
            { name: 'instrumentationLibraryVersion', type: FieldType.string, values: [] },
            { name: 'traceState', type: FieldType.string, values: [] },
            { name: 'serviceTags', type: FieldType.other, values: [] },
            { name: 'startTime', type: FieldType.number, values: [] },
            { name: 'duration', type: FieldType.number, values: [] },
            { name: 'logs', type: FieldType.other, values: [] },
            { name: 'references', type: FieldType.other, values: [] },
            { name: 'tags', type: FieldType.other, values: [] },
        ],
        meta: {
            preferredVisualisationType: 'trace',
            custom: {
                traceFormat: 'otlp',
            },
        },
    });
    try {
        for (const data of traceData) {
            const { serviceName, serviceTags } = resourceToProcess(data.resource);
            for (const librarySpan of data.instrumentationLibrarySpans) {
                for (const span of librarySpan.spans) {
                    frame.add({
                        traceID: span.traceId.length > 16 ? span.traceId.slice(16) : span.traceId,
                        spanID: span.spanId,
                        parentSpanID: span.parentSpanId || '',
                        operationName: span.name || '',
                        serviceName,
                        kind: getSpanKind(span),
                        statusCode: (_a = span.status) === null || _a === void 0 ? void 0 : _a.code,
                        statusMessage: (_b = span.status) === null || _b === void 0 ? void 0 : _b.message,
                        instrumentationLibraryName: (_c = librarySpan.instrumentationLibrary) === null || _c === void 0 ? void 0 : _c.name,
                        instrumentationLibraryVersion: (_d = librarySpan.instrumentationLibrary) === null || _d === void 0 ? void 0 : _d.version,
                        traceState: span.traceState,
                        serviceTags,
                        startTime: span.startTimeUnixNano / 1000000,
                        duration: (span.endTimeUnixNano - span.startTimeUnixNano) / 1000000,
                        tags: getSpanTags(span),
                        logs: getLogs(span),
                        references: getReferences(span),
                    });
                }
            }
        }
    }
    catch (error) {
        console.error(error);
        return { error: { message: 'JSON is not valid OpenTelemetry format: ' + error }, data: [] };
    }
    let data = [frame];
    if (nodeGraph) {
        data.push(...createGraphFrames(frame));
    }
    return { data };
}
/**
 * Transforms trace dataframes to the OpenTelemetry format
 */
export function transformToOTLP(data) {
    let result = {
        batches: [],
    };
    // Lookup object to see which batch contains spans for which services
    let services = {};
    for (let i = 0; i < data.length; i++) {
        const span = data.get(i);
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
        let batchIndex = services[span.serviceName];
        // Populate resource attributes from service tags
        if (result.batches[batchIndex].resource.attributes.length === 0) {
            result.batches[batchIndex].resource.attributes = tagsToAttributes(span.serviceTags);
        }
        // Populate instrumentation library if it exists
        if (!result.batches[batchIndex].instrumentationLibrarySpans[0].instrumentationLibrary) {
            if (span.instrumentationLibraryName) {
                result.batches[batchIndex].instrumentationLibrarySpans[0].instrumentationLibrary = {
                    name: span.instrumentationLibraryName,
                    version: span.instrumentationLibraryVersion ? span.instrumentationLibraryVersion : '',
                };
            }
        }
        result.batches[batchIndex].instrumentationLibrarySpans[0].spans.push({
            traceId: span.traceID.padStart(32, '0'),
            spanId: span.spanID,
            parentSpanId: span.parentSpanID || '',
            traceState: span.traceState || '',
            name: span.operationName,
            kind: getOTLPSpanKind(span.kind),
            startTimeUnixNano: span.startTime * 1000000,
            endTimeUnixNano: (span.startTime + span.duration) * 1000000,
            attributes: span.tags ? tagsToAttributes(span.tags) : [],
            droppedAttributesCount: 0,
            droppedEventsCount: 0,
            droppedLinksCount: 0,
            status: getOTLPStatus(span),
            events: getOTLPEvents(span.logs),
            links: getOTLPReferences(span.references),
        });
    }
    return result;
}
function getOTLPSpanKind(kind) {
    let spanKind = undefined;
    if (kind) {
        switch (kind) {
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
            case 'internal':
                spanKind = 'SPAN_KIND_INTERNAL';
                break;
        }
    }
    return spanKind;
}
/**
 * Converts key-value tags to OTLP attributes and removes tags added by Grafana
 */
function tagsToAttributes(tags) {
    return tags.reduce((attributes, tag) => [...attributes, { key: tag.key, value: toAttributeValue(tag) }], []);
}
/**
 * Returns the correct OTLP AnyValue based on the value of the tag value
 */
function toAttributeValue(tag) {
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
            const values = [];
            for (const val of tag.value) {
                values.push(toAttributeValue(val));
            }
            return { arrayValue: { values } };
        }
    }
    return { stringValue: tag.value };
}
function getOTLPStatus(span) {
    let status = undefined;
    if (span.statusCode !== undefined) {
        status = {
            code: span.statusCode,
            message: span.statusMessage ? span.statusMessage : '',
        };
    }
    return status;
}
function getOTLPEvents(logs) {
    if (!logs || !logs.length) {
        return undefined;
    }
    let events = [];
    for (const log of logs) {
        let event = {
            timeUnixNano: log.timestamp * 1000000,
            attributes: [],
            droppedAttributesCount: 0,
            name: '',
        };
        for (const field of log.fields) {
            event.attributes.push({
                key: field.key,
                value: toAttributeValue(field),
            });
        }
        events.push(event);
    }
    return events;
}
function getOTLPReferences(references) {
    var _a, _b;
    if (!references || !references.length) {
        return undefined;
    }
    let links = [];
    for (const ref of references) {
        let link = {
            traceId: ref.traceID,
            spanId: ref.spanID,
            attributes: [],
            droppedAttributesCount: 0,
        };
        if ((_a = ref.tags) === null || _a === void 0 ? void 0 : _a.length) {
            for (const tag of ref.tags) {
                (_b = link.attributes) === null || _b === void 0 ? void 0 : _b.push({
                    key: tag.key,
                    value: toAttributeValue(tag),
                });
            }
        }
        links.push(link);
    }
    return links;
}
export function transformTrace(response, nodeGraph = false) {
    const frame = response.data[0];
    if (!frame) {
        return emptyDataQueryResponse;
    }
    let data = [...response.data];
    if (nodeGraph) {
        data.push(...createGraphFrames(toDataFrame(frame)));
    }
    return Object.assign(Object.assign({}, response), { data });
}
export function createTableFrameFromSearch(data, instanceSettings) {
    const frame = new MutableDataFrame({
        name: 'Traces',
        refId: 'traces',
        fields: [
            {
                name: 'traceID',
                type: FieldType.string,
                values: [],
                config: {
                    unit: 'string',
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
                                    queryType: 'traceql',
                                },
                            },
                        },
                    ],
                },
            },
            { name: 'traceService', type: FieldType.string, config: { displayNameFromDS: 'Trace service' }, values: [] },
            { name: 'traceName', type: FieldType.string, config: { displayNameFromDS: 'Trace name' }, values: [] },
            { name: 'startTime', type: FieldType.time, config: { displayNameFromDS: 'Start time' }, values: [] },
            {
                name: 'traceDuration',
                type: FieldType.number,
                config: { displayNameFromDS: 'Duration', unit: 'ms' },
                values: [],
            },
        ],
        meta: {
            preferredVisualisationType: 'table',
        },
    });
    if (!(data === null || data === void 0 ? void 0 : data.length)) {
        return frame;
    }
    // Show the most recent traces
    const traceData = data
        .sort((a, b) => parseInt(b === null || b === void 0 ? void 0 : b.startTimeUnixNano, 10) / 1000000 - parseInt(a === null || a === void 0 ? void 0 : a.startTimeUnixNano, 10) / 1000000)
        .map(transformToTraceData);
    for (const trace of traceData) {
        frame.add(trace);
    }
    return frame;
}
function transformToTraceData(data) {
    return {
        traceID: data.traceID,
        startTime: parseInt(data.startTimeUnixNano, 10) / 1000000,
        traceDuration: data.durationMs,
        traceService: data.rootServiceName || '',
        traceName: data.rootTraceName || '',
    };
}
export function formatTraceQLResponse(data, instanceSettings, tableType) {
    if (tableType === SearchTableType.Spans) {
        return createTableFrameFromTraceQlQueryAsSpans(data, instanceSettings);
    }
    return createTableFrameFromTraceQlQuery(data, instanceSettings);
}
export function createTableFrameFromTraceQlQuery(data, instanceSettings) {
    const frame = createDataFrame({
        name: 'Traces',
        refId: 'traces',
        fields: [
            {
                name: 'traceID',
                type: FieldType.string,
                config: {
                    unit: 'string',
                    displayNameFromDS: 'Trace ID',
                    custom: {
                        width: 200,
                    },
                    links: [
                        {
                            title: 'Trace: ${__value.raw}',
                            url: '',
                            internal: {
                                datasourceUid: instanceSettings.uid,
                                datasourceName: instanceSettings.name,
                                query: {
                                    query: '${__value.raw}',
                                    queryType: 'traceql',
                                },
                            },
                        },
                    ],
                },
            },
            {
                name: 'startTime',
                type: FieldType.time,
                config: {
                    displayNameFromDS: 'Start time',
                    custom: {
                        width: 200,
                    },
                },
            },
            { name: 'traceService', type: FieldType.string, config: { displayNameFromDS: 'Service' } },
            { name: 'traceName', type: FieldType.string, config: { displayNameFromDS: 'Name' } },
            {
                name: 'traceDuration',
                type: FieldType.number,
                config: {
                    displayNameFromDS: 'Duration',
                    unit: 'ms',
                    custom: {
                        width: 120,
                    },
                },
            },
            {
                name: 'nested',
                type: FieldType.nestedFrames,
            },
        ],
        meta: {
            preferredVisualisationType: 'table',
        },
    });
    if (!(data === null || data === void 0 ? void 0 : data.length)) {
        return [frame];
    }
    frame.length = data.length;
    data
        // Show the most recent traces
        .sort((a, b) => parseInt(b === null || b === void 0 ? void 0 : b.startTimeUnixNano, 10) / 1000000 - parseInt(a === null || a === void 0 ? void 0 : a.startTimeUnixNano, 10) / 1000000)
        .forEach((trace) => {
        const traceData = transformToTraceData(trace);
        frame.fields[0].values.push(traceData.traceID);
        frame.fields[1].values.push(traceData.startTime);
        frame.fields[2].values.push(traceData.traceService);
        frame.fields[3].values.push(traceData.traceName);
        frame.fields[4].values.push(traceData.traceDuration);
        if (trace.spanSets) {
            frame.fields[5].values.push(trace.spanSets.map((spanSet) => {
                return traceSubFrame(trace, spanSet, instanceSettings);
            }));
        }
        else if (trace.spanSet) {
            frame.fields[5].values.push([traceSubFrame(trace, trace.spanSet, instanceSettings)]);
        }
    });
    return [frame];
}
export function createTableFrameFromTraceQlQueryAsSpans(data, instanceSettings) {
    const spanDynamicAttrs = {};
    let hasNameAttribute = false;
    data.forEach((t) => {
        var _a;
        return (_a = t.spanSets) === null || _a === void 0 ? void 0 : _a.forEach((ss) => {
            var _a;
            (_a = ss.attributes) === null || _a === void 0 ? void 0 : _a.forEach((attr) => {
                spanDynamicAttrs[attr.key] = {
                    name: attr.key,
                    type: FieldType.string,
                    config: { displayNameFromDS: attr.key },
                };
            });
            ss.spans.forEach((span) => {
                var _a;
                if (span.name) {
                    hasNameAttribute = true;
                }
                (_a = span.attributes) === null || _a === void 0 ? void 0 : _a.forEach((attr) => {
                    spanDynamicAttrs[attr.key] = {
                        name: attr.key,
                        type: FieldType.string,
                        config: { displayNameFromDS: attr.key },
                    };
                });
            });
        });
    });
    const frame = new MutableDataFrame({
        name: 'Spans',
        refId: 'traces',
        fields: [
            {
                name: 'traceIdHidden',
                type: FieldType.string,
                config: {
                    custom: { hidden: true },
                },
            },
            {
                name: 'traceService',
                type: FieldType.string,
                config: {
                    displayNameFromDS: 'Trace Service',
                    custom: {
                        width: 200,
                    },
                },
            },
            {
                name: 'traceName',
                type: FieldType.string,
                config: {
                    displayNameFromDS: 'Trace Name',
                    custom: {
                        width: 200,
                    },
                },
            },
            {
                name: 'spanID',
                type: FieldType.string,
                config: {
                    unit: 'string',
                    displayNameFromDS: 'Span ID',
                    custom: {
                        width: 200,
                    },
                    links: [
                        {
                            title: 'Span: ${__value.raw}',
                            url: '',
                            internal: {
                                datasourceUid: instanceSettings.uid,
                                datasourceName: instanceSettings.name,
                                query: {
                                    query: '${__data.fields.traceIdHidden}',
                                    queryType: 'traceql',
                                },
                                panelsState: {
                                    trace: {
                                        spanId: '${__value.raw}',
                                    },
                                },
                            },
                        },
                    ],
                },
            },
            {
                name: 'time',
                type: FieldType.time,
                config: {
                    displayNameFromDS: 'Start time',
                },
            },
            {
                name: 'name',
                type: FieldType.string,
                config: { displayNameFromDS: 'Name', custom: { hidden: !hasNameAttribute } },
            },
            ...Object.values(spanDynamicAttrs).sort((a, b) => a.name.localeCompare(b.name)),
            {
                name: 'duration',
                type: FieldType.number,
                config: {
                    displayNameFromDS: 'Duration',
                    unit: 'ns',
                    custom: {
                        width: 120,
                    },
                },
            },
        ],
        meta: {
            preferredVisualisationType: 'table',
        },
    });
    if (!(data === null || data === void 0 ? void 0 : data.length)) {
        return [frame];
    }
    data
        // Show the most recent traces
        .sort((a, b) => parseInt(b === null || b === void 0 ? void 0 : b.startTimeUnixNano, 10) / 1000000 - parseInt(a === null || a === void 0 ? void 0 : a.startTimeUnixNano, 10) / 1000000)
        .forEach((trace) => {
        var _a;
        (_a = trace.spanSets) === null || _a === void 0 ? void 0 : _a.forEach((spanSet) => {
            spanSet.spans.forEach((span) => {
                frame.add(transformSpanToTraceData(span, spanSet, trace));
            });
        });
    });
    return [frame];
}
const traceSubFrame = (trace, spanSet, instanceSettings) => {
    var _a;
    const spanDynamicAttrs = {};
    let hasNameAttribute = false;
    (_a = spanSet.attributes) === null || _a === void 0 ? void 0 : _a.map((attr) => {
        spanDynamicAttrs[attr.key] = {
            name: attr.key,
            type: FieldType.string,
            config: { displayNameFromDS: attr.key },
            values: [],
        };
    });
    spanSet.spans.forEach((span) => {
        var _a;
        if (span.name) {
            hasNameAttribute = true;
        }
        (_a = span.attributes) === null || _a === void 0 ? void 0 : _a.forEach((attr) => {
            spanDynamicAttrs[attr.key] = {
                name: attr.key,
                type: FieldType.string,
                config: { displayNameFromDS: attr.key },
                values: [],
            };
        });
    });
    const subFrame = new MutableDataFrame({
        fields: [
            {
                name: 'traceIdHidden',
                type: FieldType.string,
                config: {
                    custom: { hidden: true },
                },
                values: [],
            },
            {
                name: 'spanID',
                type: FieldType.string,
                values: [],
                config: {
                    unit: 'string',
                    displayNameFromDS: 'Span ID',
                    custom: {
                        width: 200,
                    },
                    links: [
                        {
                            title: 'Span: ${__value.raw}',
                            url: '',
                            internal: {
                                datasourceUid: instanceSettings.uid,
                                datasourceName: instanceSettings.name,
                                query: {
                                    query: '${__data.fields.traceIdHidden}',
                                    queryType: 'traceql',
                                },
                                panelsState: {
                                    trace: {
                                        spanId: '${__value.raw}',
                                    },
                                },
                            },
                        },
                    ],
                },
            },
            {
                name: 'time',
                type: FieldType.time,
                config: {
                    displayNameFromDS: 'Start time',
                    custom: {
                        width: 200,
                    },
                },
            },
            {
                name: 'name',
                type: FieldType.string,
                values: [],
                config: { displayNameFromDS: 'Name', custom: { hidden: !hasNameAttribute } },
            },
            ...Object.values(spanDynamicAttrs).sort((a, b) => a.name.localeCompare(b.name)),
            {
                name: 'duration',
                type: FieldType.number,
                values: [],
                config: {
                    displayNameFromDS: 'Duration',
                    unit: 'ns',
                    custom: {
                        width: 120,
                    },
                },
            },
        ],
        meta: {
            preferredVisualisationType: 'table',
        },
    });
    const theme = createTheme();
    for (const field of subFrame.fields) {
        field.display = getDisplayProcessor({ field, theme });
    }
    spanSet.spans.forEach((span) => {
        subFrame.add(transformSpanToTraceData(span, spanSet, trace));
    });
    return subFrame;
};
function transformSpanToTraceData(span, spanSet, trace) {
    const spanStartTimeUnixMs = parseInt(span.startTimeUnixNano, 10) / 1000000;
    const data = {
        traceIdHidden: trace.traceID,
        traceService: trace.rootServiceName || '',
        traceName: trace.rootTraceName || '',
        spanID: span.spanID,
        time: spanStartTimeUnixMs,
        duration: parseInt(span.durationNanos, 10),
        name: span.name,
    };
    let attrs = [];
    if (spanSet.attributes) {
        attrs = attrs.concat(spanSet.attributes);
    }
    if (span.attributes) {
        attrs = attrs.concat(span.attributes);
    }
    attrs.forEach((attr) => {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        if (attr.value.boolValue || ((_a = attr.value.Value) === null || _a === void 0 ? void 0 : _a.bool_value)) {
            data[attr.key] = attr.value.boolValue || ((_b = attr.value.Value) === null || _b === void 0 ? void 0 : _b.bool_value);
        }
        if (attr.value.doubleValue || ((_c = attr.value.Value) === null || _c === void 0 ? void 0 : _c.double_value)) {
            data[attr.key] = attr.value.doubleValue || ((_d = attr.value.Value) === null || _d === void 0 ? void 0 : _d.double_value);
        }
        if (attr.value.intValue || ((_e = attr.value.Value) === null || _e === void 0 ? void 0 : _e.int_value)) {
            data[attr.key] = attr.value.intValue || ((_f = attr.value.Value) === null || _f === void 0 ? void 0 : _f.int_value);
        }
        if (attr.value.stringValue || ((_g = attr.value.Value) === null || _g === void 0 ? void 0 : _g.string_value)) {
            data[attr.key] = attr.value.stringValue || ((_h = attr.value.Value) === null || _h === void 0 ? void 0 : _h.string_value);
        }
    });
    return data;
}
const emptyDataQueryResponse = {
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