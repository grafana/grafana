import { __read, __spreadArray } from "tslib";
import { dateTime, mapInternalLinkToExplore, rangeUtil, } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { Icon } from '@grafana/ui';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import React from 'react';
import { getFieldLinksForExplore } from '../utils/links';
/**
 * This is a factory for the link creator. It returns the function mainly so it can return undefined in which case
 * the trace view won't create any links and to capture the datasource and split function making it easier to memoize
 * with useMemo.
 */
export function createSpanLinkFactory(_a) {
    var splitOpenFn = _a.splitOpenFn, traceToLogsOptions = _a.traceToLogsOptions, dataFrame = _a.dataFrame;
    if (!dataFrame || dataFrame.fields.length === 1 || !dataFrame.fields.some(function (f) { var _a; return Boolean((_a = f.config.links) === null || _a === void 0 ? void 0 : _a.length); })) {
        // if the dataframe contains just a single blob of data (legacy format) or does not have any links configured,
        // let's try to use the old legacy path.
        return legacyCreateSpanLinkFactory(splitOpenFn, traceToLogsOptions);
    }
    else {
        return function (span) {
            // We should be here only if there are some links in the dataframe
            var field = dataFrame.fields.find(function (f) { var _a; return Boolean((_a = f.config.links) === null || _a === void 0 ? void 0 : _a.length); });
            try {
                var links = getFieldLinksForExplore({
                    field: field,
                    rowIndex: span.dataFrameRowIndex,
                    splitOpenFn: splitOpenFn,
                    range: getTimeRangeFromSpan(span),
                    dataFrame: dataFrame,
                });
                return {
                    href: links[0].href,
                    onClick: links[0].onClick,
                    content: React.createElement(Icon, { name: "gf-logs", title: "Explore the logs for this in split view" }),
                };
            }
            catch (error) {
                // It's fairly easy to crash here for example if data source defines wrong interpolation in the data link
                console.error(error);
                return undefined;
            }
        };
    }
}
function legacyCreateSpanLinkFactory(splitOpenFn, traceToLogsOptions) {
    // We should return if dataSourceUid is undefined otherwise getInstanceSettings would return testDataSource.
    if (!(traceToLogsOptions === null || traceToLogsOptions === void 0 ? void 0 : traceToLogsOptions.datasourceUid)) {
        return undefined;
    }
    var dataSourceSettings = getDatasourceSrv().getInstanceSettings(traceToLogsOptions.datasourceUid);
    if (!dataSourceSettings) {
        return undefined;
    }
    return function (span) {
        // This is reusing existing code from derived fields which may not be ideal match so some data is a bit faked at
        // the moment. Issue is that the trace itself isn't clearly mapped to dataFrame (right now it's just a json blob
        // inside a single field) so the dataLinks as config of that dataFrame abstraction breaks down a bit and we do
        // it manually here instead of leaving it for the data source to supply the config.
        var dataLink = {
            title: dataSourceSettings.name,
            url: '',
            internal: {
                datasourceUid: dataSourceSettings.uid,
                datasourceName: dataSourceSettings.name,
                query: {
                    expr: getLokiQueryFromSpan(span, traceToLogsOptions),
                    refId: '',
                },
            },
        };
        var link = mapInternalLinkToExplore({
            link: dataLink,
            internalLink: dataLink.internal,
            scopedVars: {},
            range: getTimeRangeFromSpan(span, {
                startMs: traceToLogsOptions.spanStartTimeShift
                    ? rangeUtil.intervalToMs(traceToLogsOptions.spanStartTimeShift)
                    : 0,
                endMs: traceToLogsOptions.spanEndTimeShift ? rangeUtil.intervalToMs(traceToLogsOptions.spanEndTimeShift) : 0,
            }),
            field: {},
            onClickFn: splitOpenFn,
            replaceVariables: getTemplateSrv().replace.bind(getTemplateSrv()),
        });
        return {
            href: link.href,
            onClick: link.onClick,
            content: React.createElement(Icon, { name: "gf-logs", title: "Explore the logs for this in split view" }),
        };
    };
}
/**
 * Default keys to use when there are no configured tags.
 */
var defaultKeys = ['cluster', 'hostname', 'namespace', 'pod'];
function getLokiQueryFromSpan(span, options) {
    var keys = options.tags, filterByTraceID = options.filterByTraceID, filterBySpanID = options.filterBySpanID;
    var keysToCheck = (keys === null || keys === void 0 ? void 0 : keys.length) ? keys : defaultKeys;
    var tags = __spreadArray(__spreadArray([], __read(span.process.tags), false), __read(span.tags), false).reduce(function (acc, tag) {
        if (keysToCheck.includes(tag.key)) {
            acc.push(tag.key + "=\"" + tag.value + "\"");
        }
        return acc;
    }, []);
    var query = "{" + tags.join(', ') + "}";
    if (filterByTraceID && span.traceID) {
        query += " |=\"" + span.traceID + "\"";
    }
    if (filterBySpanID && span.spanID) {
        query += " |=\"" + span.spanID + "\"";
    }
    return query;
}
/**
 * Gets a time range from the span.
 */
function getTimeRangeFromSpan(span, timeShift) {
    if (timeShift === void 0) { timeShift = { startMs: 0, endMs: 0 }; }
    var adjustedStartTime = Math.floor(span.startTime / 1000 + timeShift.startMs);
    var from = dateTime(adjustedStartTime);
    var spanEndMs = (span.startTime + span.duration) / 1000;
    var adjustedEndTime = Math.floor(spanEndMs + timeShift.endMs);
    // Because we can only pass milliseconds in the url we need to check if they equal.
    // We need end time to be later than start time
    if (adjustedStartTime === adjustedEndTime) {
        adjustedEndTime++;
    }
    var to = dateTime(adjustedEndTime);
    // Beware that public/app/features/explore/state/main.ts SplitOpen fn uses the range from here. No matter what is in the url.
    return {
        from: from,
        to: to,
        raw: {
            from: from,
            to: to,
        },
    };
}
//# sourceMappingURL=createSpanLink.js.map