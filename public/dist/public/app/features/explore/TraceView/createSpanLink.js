import React from 'react';
import { dateTime, mapInternalLinkToExplore, rangeUtil, } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { Icon } from '@grafana/ui';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { getFieldLinksForExplore, getVariableUsageInfo } from '../utils/links';
import { SpanLinkType } from './components/types/links';
/**
 * This is a factory for the link creator. It returns the function mainly so it can return undefined in which case
 * the trace view won't create any links and to capture the datasource and split function making it easier to memoize
 * with useMemo.
 */
export function createSpanLinkFactory({ splitOpenFn, traceToLogsOptions, traceToMetricsOptions, dataFrame, createFocusSpanLink, trace, }) {
    if (!dataFrame) {
        return undefined;
    }
    let scopedVars = scopedVarsFromTrace(trace);
    const hasLinks = dataFrame.fields.some((f) => { var _a; return Boolean((_a = f.config.links) === null || _a === void 0 ? void 0 : _a.length); });
    const createSpanLinks = legacyCreateSpanLinkFactory(splitOpenFn, 
    // We need this to make the types happy but for this branch of code it does not matter which field we supply.
    dataFrame.fields[0], traceToLogsOptions, traceToMetricsOptions, createFocusSpanLink, scopedVars);
    return function SpanLink(span) {
        let spanLinks = createSpanLinks(span);
        if (hasLinks) {
            scopedVars = Object.assign(Object.assign({}, scopedVars), scopedVarsFromSpan(span));
            // We should be here only if there are some links in the dataframe
            const fields = dataFrame.fields.filter((f) => { var _a; return Boolean((_a = f.config.links) === null || _a === void 0 ? void 0 : _a.length); });
            try {
                let links = [];
                fields.forEach((field) => {
                    const fieldLinksForExplore = getFieldLinksForExplore({
                        field,
                        rowIndex: span.dataFrameRowIndex,
                        splitOpenFn,
                        range: getTimeRangeFromSpan(span),
                        dataFrame,
                        vars: scopedVars,
                    });
                    links = links.concat(fieldLinksForExplore);
                });
                const newSpanLinks = links.map((link) => {
                    return {
                        title: link.title,
                        href: link.href,
                        onClick: link.onClick,
                        content: React.createElement(Icon, { name: "link", title: link.title || 'Link' }),
                        field: link.origin,
                        type: SpanLinkType.Unknown,
                    };
                });
                spanLinks.push.apply(spanLinks, newSpanLinks);
            }
            catch (error) {
                // It's fairly easy to crash here for example if data source defines wrong interpolation in the data link
                console.error(error);
                return spanLinks;
            }
        }
        return spanLinks;
    };
}
/**
 * Default keys to use when there are no configured tags.
 */
const defaultKeys = ['cluster', 'hostname', 'namespace', 'pod', 'service.name', 'service.namespace'].map((k) => ({
    key: k,
    value: k.includes('.') ? k.replace('.', '_') : undefined,
}));
function legacyCreateSpanLinkFactory(splitOpenFn, field, traceToLogsOptions, traceToMetricsOptions, createFocusSpanLink, scopedVars) {
    let logsDataSourceSettings;
    if (traceToLogsOptions === null || traceToLogsOptions === void 0 ? void 0 : traceToLogsOptions.datasourceUid) {
        logsDataSourceSettings = getDatasourceSrv().getInstanceSettings(traceToLogsOptions.datasourceUid);
    }
    const isSplunkDS = (logsDataSourceSettings === null || logsDataSourceSettings === void 0 ? void 0 : logsDataSourceSettings.type) === 'grafana-splunk-datasource';
    let metricsDataSourceSettings;
    if (traceToMetricsOptions === null || traceToMetricsOptions === void 0 ? void 0 : traceToMetricsOptions.datasourceUid) {
        metricsDataSourceSettings = getDatasourceSrv().getInstanceSettings(traceToMetricsOptions.datasourceUid);
    }
    return function SpanLink(span) {
        scopedVars = Object.assign(Object.assign({}, scopedVars), scopedVarsFromSpan(span));
        const links = [];
        let query;
        let tags = '';
        // TODO: This should eventually move into specific data sources and added to the data frame as we no longer use the
        //  deprecated blob format and we can map the link easily in data frame.
        if (logsDataSourceSettings && traceToLogsOptions) {
            const customQuery = traceToLogsOptions.customQuery ? traceToLogsOptions.query : undefined;
            const tagsToUse = traceToLogsOptions.tags && traceToLogsOptions.tags.length > 0 ? traceToLogsOptions.tags : defaultKeys;
            switch (logsDataSourceSettings === null || logsDataSourceSettings === void 0 ? void 0 : logsDataSourceSettings.type) {
                case 'loki':
                    tags = getFormattedTags(span, tagsToUse);
                    query = getQueryForLoki(span, traceToLogsOptions, tags, customQuery);
                    break;
                case 'grafana-splunk-datasource':
                    tags = getFormattedTags(span, tagsToUse, { joinBy: ' ' });
                    query = getQueryForSplunk(span, traceToLogsOptions, tags, customQuery);
                    break;
                case 'elasticsearch':
                case 'grafana-opensearch-datasource':
                    tags = getFormattedTags(span, tagsToUse, { labelValueSign: ':', joinBy: ' AND ' });
                    query = getQueryForElasticsearchOrOpensearch(span, traceToLogsOptions, tags, customQuery);
                    break;
                case 'grafana-falconlogscale-datasource':
                    tags = getFormattedTags(span, tagsToUse, { joinBy: ' OR ' });
                    query = getQueryForFalconLogScale(span, traceToLogsOptions, tags, customQuery);
                    break;
                case 'googlecloud-logging-datasource':
                    tags = getFormattedTags(span, tagsToUse, { joinBy: ' AND ' });
                    query = getQueryForGoogleCloudLogging(span, traceToLogsOptions, tags, customQuery);
            }
            // query can be false in case the simple UI tag mapping is used but none of them are present in the span.
            // For custom query, this is always defined and we check if the interpolation matched all variables later on.
            if (query) {
                const dataLink = {
                    title: logsDataSourceSettings.name,
                    url: '',
                    internal: {
                        datasourceUid: logsDataSourceSettings.uid,
                        datasourceName: logsDataSourceSettings.name,
                        query,
                    },
                };
                scopedVars = Object.assign(Object.assign({}, scopedVars), { __tags: {
                        text: 'Tags',
                        value: tags,
                    } });
                // Check if all variables are defined and don't show if they aren't. This is usually handled by the
                // getQueryFor* functions but this is for case of custom query supplied by the user.
                if (getVariableUsageInfo(dataLink.internal.query, scopedVars).allVariablesDefined) {
                    const link = mapInternalLinkToExplore({
                        link: dataLink,
                        internalLink: dataLink.internal,
                        scopedVars: scopedVars,
                        range: getTimeRangeFromSpan(span, {
                            startMs: traceToLogsOptions.spanStartTimeShift
                                ? rangeUtil.intervalToMs(traceToLogsOptions.spanStartTimeShift)
                                : 0,
                            endMs: traceToLogsOptions.spanEndTimeShift
                                ? rangeUtil.intervalToMs(traceToLogsOptions.spanEndTimeShift)
                                : 0,
                        }, isSplunkDS),
                        field: {},
                        onClickFn: splitOpenFn,
                        replaceVariables: getTemplateSrv().replace.bind(getTemplateSrv()),
                    });
                    links.push({
                        href: link.href,
                        title: 'Related logs',
                        onClick: link.onClick,
                        content: React.createElement(Icon, { name: "gf-logs", title: "Explore the logs for this in split view" }),
                        field,
                        type: SpanLinkType.Logs,
                    });
                }
            }
        }
        // Get metrics links
        if (metricsDataSourceSettings && (traceToMetricsOptions === null || traceToMetricsOptions === void 0 ? void 0 : traceToMetricsOptions.queries)) {
            for (const query of traceToMetricsOptions.queries) {
                const expr = buildMetricsQuery(query, (traceToMetricsOptions === null || traceToMetricsOptions === void 0 ? void 0 : traceToMetricsOptions.tags) || [], span);
                const dataLink = {
                    title: metricsDataSourceSettings.name,
                    url: '',
                    internal: {
                        datasourceUid: metricsDataSourceSettings.uid,
                        datasourceName: metricsDataSourceSettings.name,
                        query: {
                            expr,
                            refId: 'A',
                        },
                    },
                };
                const link = mapInternalLinkToExplore({
                    link: dataLink,
                    internalLink: dataLink.internal,
                    scopedVars: {},
                    range: getTimeRangeFromSpan(span, {
                        startMs: traceToMetricsOptions.spanStartTimeShift
                            ? rangeUtil.intervalToMs(traceToMetricsOptions.spanStartTimeShift)
                            : -120000,
                        endMs: traceToMetricsOptions.spanEndTimeShift
                            ? rangeUtil.intervalToMs(traceToMetricsOptions.spanEndTimeShift)
                            : 120000,
                    }),
                    field: {},
                    onClickFn: splitOpenFn,
                    replaceVariables: getTemplateSrv().replace.bind(getTemplateSrv()),
                });
                links.push({
                    title: query === null || query === void 0 ? void 0 : query.name,
                    href: link.href,
                    onClick: link.onClick,
                    content: React.createElement(Icon, { name: "chart-line", title: "Explore metrics for this span" }),
                    field,
                    type: SpanLinkType.Metrics,
                });
            }
        }
        // Get trace links
        if (span.references && createFocusSpanLink) {
            for (const reference of span.references) {
                // Ignore parent-child links
                if (reference.refType === 'CHILD_OF') {
                    continue;
                }
                const link = createFocusSpanLink(reference.traceID, reference.spanID);
                links.push({
                    href: link.href,
                    title: reference.span ? reference.span.operationName : 'View linked span',
                    content: React.createElement(Icon, { name: "link", title: "View linked span" }),
                    onClick: link.onClick,
                    field: link.origin,
                    type: SpanLinkType.Traces,
                });
            }
        }
        if (span.subsidiarilyReferencedBy && createFocusSpanLink) {
            for (const reference of span.subsidiarilyReferencedBy) {
                const link = createFocusSpanLink(reference.traceID, reference.spanID);
                links.push({
                    href: link.href,
                    title: reference.span ? reference.span.operationName : 'View linked span',
                    content: React.createElement(Icon, { name: "link", title: "View linked span" }),
                    onClick: link.onClick,
                    field: link.origin,
                    type: SpanLinkType.Traces,
                });
            }
        }
        return links;
    };
}
function getQueryForLoki(span, options, tags, customQuery) {
    const { filterByTraceID, filterBySpanID } = options;
    if (customQuery) {
        return { expr: customQuery, refId: '' };
    }
    if (!tags) {
        return undefined;
    }
    let expr = '{${__tags}}';
    if (filterByTraceID && span.traceID) {
        expr += ' |="${__span.traceId}"';
    }
    if (filterBySpanID && span.spanID) {
        expr += ' |="${__span.spanId}"';
    }
    return {
        expr: expr,
        refId: '',
    };
}
function getQueryForElasticsearchOrOpensearch(span, options, tags, customQuery) {
    const { filterByTraceID, filterBySpanID } = options;
    if (customQuery) {
        return {
            query: customQuery,
            refId: '',
            metrics: [{ id: '1', type: 'logs' }],
        };
    }
    let queryArr = [];
    if (filterBySpanID && span.spanID) {
        queryArr.push('"${__span.spanId}"');
    }
    if (filterByTraceID && span.traceID) {
        queryArr.push('"${__span.traceId}"');
    }
    if (tags) {
        queryArr.push('${__tags}');
    }
    return {
        query: queryArr.join(' AND '),
        refId: '',
        metrics: [{ id: '1', type: 'logs' }],
    };
}
function getQueryForSplunk(span, options, tags, customQuery) {
    const { filterByTraceID, filterBySpanID } = options;
    if (customQuery) {
        return { query: customQuery, refId: '' };
    }
    let query = '';
    if (tags) {
        query += '${__tags}';
    }
    if (filterByTraceID && span.traceID) {
        query += ' "${__span.traceId}"';
    }
    if (filterBySpanID && span.spanID) {
        query += ' "${__span.spanId}"';
    }
    return {
        query: query,
        refId: '',
    };
}
function getQueryForGoogleCloudLogging(span, options, tags, customQuery) {
    const { filterByTraceID, filterBySpanID } = options;
    if (customQuery) {
        return { query: customQuery, refId: '' };
    }
    let queryArr = [];
    if (filterBySpanID && span.spanID) {
        queryArr.push('"${__span.spanId}"');
    }
    if (filterByTraceID && span.traceID) {
        queryArr.push('"${__span.traceId}"');
    }
    if (tags) {
        queryArr.push('${__tags}');
    }
    return {
        query: queryArr.join(' AND '),
        refId: '',
    };
}
function getQueryForFalconLogScale(span, options, tags, customQuery) {
    const { filterByTraceID, filterBySpanID } = options;
    if (customQuery) {
        return {
            lsql: customQuery,
            refId: '',
        };
    }
    if (!tags) {
        return undefined;
    }
    let lsql = '${__tags}';
    if (filterByTraceID && span.traceID) {
        lsql += ' or "${__span.traceId}"';
    }
    if (filterBySpanID && span.spanID) {
        lsql += ' or "${__span.spanId}"';
    }
    return {
        lsql,
        refId: '',
    };
}
/**
 * Creates a string representing all the tags already formatted for use in the query. The tags are filtered so that
 * only intersection of tags that exist in a span and tags that you want are serialized into the string.
 */
function getFormattedTags(span, tags, { labelValueSign = '=', joinBy = ', ' } = {}) {
    // In order, try to use mapped tags -> tags -> default tags
    // Build tag portion of query
    return [
        ...span.process.tags,
        ...span.tags,
        { key: 'spanId', value: span.spanID },
        { key: 'traceId', value: span.traceID },
        { key: 'name', value: span.operationName },
        { key: 'duration', value: span.duration },
    ]
        .map((tag) => {
        const keyValue = tags.find((keyValue) => keyValue.key === tag.key);
        if (keyValue) {
            return `${keyValue.value ? keyValue.value : keyValue.key}${labelValueSign}"${tag.value}"`;
        }
        return undefined;
    })
        .filter((v) => Boolean(v))
        .join(joinBy);
}
/**
 * Gets a time range from the span.
 */
function getTimeRangeFromSpan(span, timeShift = { startMs: 0, endMs: 0 }, isSplunkDS = false) {
    const adjustedStartTime = Math.floor(span.startTime / 1000 + timeShift.startMs);
    const from = dateTime(adjustedStartTime);
    const spanEndMs = (span.startTime + span.duration) / 1000;
    let adjustedEndTime = Math.floor(spanEndMs + timeShift.endMs);
    // Splunk requires a time interval of >= 1s, rather than >=1ms like Loki timerange in below elseif block
    if (isSplunkDS && adjustedEndTime - adjustedStartTime < 1000) {
        adjustedEndTime = adjustedStartTime + 1000;
    }
    else if (adjustedStartTime === adjustedEndTime) {
        // Because we can only pass milliseconds in the url we need to check if they equal.
        // We need end time to be later than start time
        adjustedEndTime++;
    }
    const to = dateTime(adjustedEndTime);
    // Beware that public/app/features/explore/state/main.ts SplitOpen fn uses the range from here. No matter what is in the url.
    return {
        from,
        to,
        raw: {
            from,
            to,
        },
    };
}
// Interpolates span attributes into trace to metric query, or returns default query
function buildMetricsQuery(query, tags = [], span) {
    if (!query.query) {
        return `histogram_quantile(0.5, sum(rate(traces_spanmetrics_latency_bucket{service="${span.process.serviceName}"}[5m])) by (le))`;
    }
    let expr = query.query;
    if (tags.length && expr.indexOf('$__tags') !== -1) {
        const spanTags = [...span.process.tags, ...span.tags];
        const labels = tags.reduce((acc, tag) => {
            var _a;
            const tagValue = (_a = spanTags.find((t) => t.key === tag.key)) === null || _a === void 0 ? void 0 : _a.value;
            if (tagValue) {
                acc.push(`${tag.value ? tag.value : tag.key}="${tagValue}"`);
            }
            return acc;
        }, []);
        const labelsQuery = labels === null || labels === void 0 ? void 0 : labels.join(', ');
        expr = expr.replace(/\$__tags/g, labelsQuery);
    }
    return expr;
}
/**
 * Variables from trace that can be used in the query
 * @param trace
 */
function scopedVarsFromTrace(trace) {
    return {
        __trace: {
            text: 'Trace',
            value: {
                duration: trace.duration,
                name: trace.traceName,
                traceId: trace.traceID,
            },
        },
    };
}
/**
 * Variables from span that can be used in the query
 * @param span
 */
function scopedVarsFromSpan(span) {
    const tags = {};
    // We put all these tags together similar way we do for the __tags variable. This means there can be some overriding
    // of values if there is the same tag in both process tags and span tags.
    for (const tag of span.process.tags) {
        tags[tag.key] = tag.value;
    }
    for (const tag of span.tags) {
        tags[tag.key] = tag.value;
    }
    return {
        __span: {
            text: 'Span',
            value: {
                spanId: span.spanID,
                traceId: span.traceID,
                duration: span.duration,
                name: span.operationName,
                tags: tags,
            },
        },
    };
}
//# sourceMappingURL=createSpanLink.js.map