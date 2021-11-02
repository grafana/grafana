import { __assign, __read } from "tslib";
import { DataFrameView } from '@grafana/data';
import { colors, useTheme } from '@grafana/ui';
import { ThemeProvider, ThemeType, TracePageHeader, TraceTimelineViewer, transformTraceData, UIElementsContext, } from '@jaegertracing/jaeger-ui-components';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { getTimeZone } from 'app/features/profile/state/selectors';
import React, { useCallback, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { createSpanLinkFactory } from './createSpanLink';
import { UIElements } from './uiElements';
import { useChildrenState } from './useChildrenState';
import { useDetailState } from './useDetailState';
import { useHoverIndentGuide } from './useHoverIndentGuide';
import { useSearch } from './useSearch';
import { useViewRange } from './useViewRange';
function noop() {
    return {};
}
export function TraceView(props) {
    var _a, _b, _c;
    var _d = useChildrenState(), expandOne = _d.expandOne, collapseOne = _d.collapseOne, childrenToggle = _d.childrenToggle, collapseAll = _d.collapseAll, childrenHiddenIDs = _d.childrenHiddenIDs, expandAll = _d.expandAll;
    var _e = useDetailState(), detailStates = _e.detailStates, toggleDetail = _e.toggleDetail, detailLogItemToggle = _e.detailLogItemToggle, detailLogsToggle = _e.detailLogsToggle, detailProcessToggle = _e.detailProcessToggle, detailReferencesToggle = _e.detailReferencesToggle, detailTagsToggle = _e.detailTagsToggle, detailWarningsToggle = _e.detailWarningsToggle, detailStackTracesToggle = _e.detailStackTracesToggle;
    var _f = useHoverIndentGuide(), removeHoverIndentGuideId = _f.removeHoverIndentGuideId, addHoverIndentGuideId = _f.addHoverIndentGuideId, hoverIndentGuideIds = _f.hoverIndentGuideIds;
    var _g = useViewRange(), viewRange = _g.viewRange, updateViewRangeTime = _g.updateViewRangeTime, updateNextViewRangeTime = _g.updateNextViewRangeTime;
    /**
     * Keeps state of resizable name column width
     */
    var _h = __read(useState(0.25), 2), spanNameColumnWidth = _h[0], setSpanNameColumnWidth = _h[1];
    /**
     * State of the top minimap, slim means it is collapsed.
     */
    var _j = __read(useState(false), 2), slim = _j[0], setSlim = _j[1];
    // At this point we only show single trace.
    var frame = props.dataFrames[0];
    var traceProp = useMemo(function () { return transformDataFrames(frame); }, [frame]);
    var _k = useSearch(traceProp === null || traceProp === void 0 ? void 0 : traceProp.spans), search = _k.search, setSearch = _k.setSearch, spanFindMatches = _k.spanFindMatches;
    var dataSourceName = useSelector(function (state) { var _a, _b; return (_b = (_a = state.explore[props.exploreId]) === null || _a === void 0 ? void 0 : _a.datasourceInstance) === null || _b === void 0 ? void 0 : _b.name; });
    var traceToLogsOptions = (_b = (_a = getDatasourceSrv().getInstanceSettings(dataSourceName)) === null || _a === void 0 ? void 0 : _a.jsonData) === null || _b === void 0 ? void 0 : _b.tracesToLogs;
    var timeZone = useSelector(function (state) { return getTimeZone(state.user); });
    var theme = useTheme();
    var traceTheme = useMemo(function () {
        return ({
            type: theme.isDark ? ThemeType.Dark : ThemeType.Light,
            servicesColorPalette: colors,
            components: {
                TraceName: {
                    fontSize: theme.typography.size.lg,
                },
            },
        });
    }, [theme]);
    var traceTimeline = useMemo(function () { return ({
        childrenHiddenIDs: childrenHiddenIDs,
        detailStates: detailStates,
        hoverIndentGuideIds: hoverIndentGuideIds,
        shouldScrollToFirstUiFindMatch: false,
        spanNameColumnWidth: spanNameColumnWidth,
        traceID: traceProp === null || traceProp === void 0 ? void 0 : traceProp.traceID,
    }); }, [childrenHiddenIDs, detailStates, hoverIndentGuideIds, spanNameColumnWidth, traceProp === null || traceProp === void 0 ? void 0 : traceProp.traceID]);
    var createSpanLink = useMemo(function () { return createSpanLinkFactory({ splitOpenFn: props.splitOpenFn, traceToLogsOptions: traceToLogsOptions, dataFrame: frame }); }, [props.splitOpenFn, traceToLogsOptions, frame]);
    var scrollElement = document.getElementsByClassName('scrollbar-view')[0];
    var onSlimViewClicked = useCallback(function () { return setSlim(!slim); }, [slim]);
    if (!((_c = props.dataFrames) === null || _c === void 0 ? void 0 : _c.length) || !traceProp) {
        return null;
    }
    return (React.createElement(ThemeProvider, { value: traceTheme },
        React.createElement(UIElementsContext.Provider, { value: UIElements },
            React.createElement(TracePageHeader, { canCollapse: false, clearSearch: noop, focusUiFindMatches: noop, hideMap: false, hideSummary: false, nextResult: noop, onSlimViewClicked: onSlimViewClicked, onTraceGraphViewClicked: noop, prevResult: noop, resultCount: 0, slimView: slim, textFilter: null, trace: traceProp, traceGraphView: false, updateNextViewRangeTime: updateNextViewRangeTime, updateViewRangeTime: updateViewRangeTime, viewRange: viewRange, searchValue: search, onSearchValueChange: setSearch, hideSearchButtons: true, timeZone: timeZone }),
            React.createElement(TraceTimelineViewer, { registerAccessors: noop, scrollToFirstVisibleSpan: noop, findMatchesIDs: spanFindMatches, trace: traceProp, traceTimeline: traceTimeline, updateNextViewRangeTime: updateNextViewRangeTime, updateViewRangeTime: updateViewRangeTime, viewRange: viewRange, focusSpan: noop, createLinkToExternalSpan: noop, setSpanNameColumnWidth: setSpanNameColumnWidth, collapseAll: collapseAll, collapseOne: collapseOne, expandAll: expandAll, expandOne: expandOne, childrenToggle: childrenToggle, clearShouldScrollToFirstUiFindMatch: noop, detailLogItemToggle: detailLogItemToggle, detailLogsToggle: detailLogsToggle, detailWarningsToggle: detailWarningsToggle, detailStackTracesToggle: detailStackTracesToggle, detailReferencesToggle: detailReferencesToggle, detailProcessToggle: detailProcessToggle, detailTagsToggle: detailTagsToggle, detailToggle: toggleDetail, setTrace: noop, addHoverIndentGuideId: addHoverIndentGuideId, removeHoverIndentGuideId: removeHoverIndentGuideId, linksGetter: noop, uiFind: search, createSpanLink: createSpanLink, scrollElement: scrollElement }))));
}
function transformDataFrames(frame) {
    if (!frame) {
        return null;
    }
    var data = frame.fields.length === 1
        ? // For backward compatibility when we sent whole json response in a single field/value
            frame.fields[0].values.get(0)
        : transformTraceDataFrame(frame);
    return transformTraceData(data);
}
function transformTraceDataFrame(frame) {
    var view = new DataFrameView(frame);
    var processes = {};
    for (var i = 0; i < view.length; i++) {
        var span = view.get(i);
        if (!processes[span.serviceName]) {
            processes[span.serviceName] = {
                serviceName: span.serviceName,
                tags: span.serviceTags,
            };
        }
    }
    return {
        traceID: view.get(0).traceID,
        processes: processes,
        spans: view.toArray().map(function (s, index) {
            var _a;
            return __assign(__assign({}, s), { duration: s.duration * 1000, startTime: s.startTime * 1000, processID: s.serviceName, flags: 0, references: s.parentSpanID ? [{ refType: 'CHILD_OF', spanID: s.parentSpanID, traceID: s.traceID }] : undefined, logs: ((_a = s.logs) === null || _a === void 0 ? void 0 : _a.map(function (l) { return (__assign(__assign({}, l), { timestamp: l.timestamp * 1000 })); })) || [], dataFrameRowIndex: index });
        }),
    };
}
//# sourceMappingURL=TraceView.js.map