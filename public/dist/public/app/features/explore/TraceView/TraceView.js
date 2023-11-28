import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';
import { useToggle } from 'react-use';
import { CoreApp, mapInternalLinkToExplore, } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import { getTraceToLogsOptions } from 'app/core/components/TraceToLogs/TraceToLogsSettings';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { getTimeZone } from 'app/features/profile/state/selectors';
import { useDispatch, useSelector } from 'app/types';
import { changePanelState } from '../state/explorePane';
import { TracePageHeader, TraceTimelineViewer, } from './components';
import SpanGraph from './components/TracePageHeader/SpanGraph';
import { createSpanLinkFactory } from './createSpanLink';
import { useChildrenState } from './useChildrenState';
import { useDetailState } from './useDetailState';
import { useHoverIndentGuide } from './useHoverIndentGuide';
import { useSearch } from './useSearch';
import { useViewRange } from './useViewRange';
const getStyles = (theme) => ({
    noDataMsg: css `
    height: 100%;
    width: 100%;
    display: grid;
    place-items: center;
    font-size: ${theme.typography.h4.fontSize};
    color: ${theme.colors.text.secondary};
  `,
});
export function TraceView(props) {
    var _a, _b, _c, _d;
    const { traceProp, datasource, topOfViewRef, topOfViewRefType, exploreId, createSpanLink: createSpanLinkFromProps, } = props;
    const { detailStates, toggleDetail, detailLogItemToggle, detailLogsToggle, detailProcessToggle, detailReferencesToggle, detailReferenceItemToggle, detailTagsToggle, detailWarningsToggle, detailStackTracesToggle, } = useDetailState(props.dataFrames[0]);
    const { removeHoverIndentGuideId, addHoverIndentGuideId, hoverIndentGuideIds } = useHoverIndentGuide();
    const { viewRange, updateViewRangeTime, updateNextViewRangeTime } = useViewRange();
    const { expandOne, collapseOne, childrenToggle, collapseAll, childrenHiddenIDs, expandAll } = useChildrenState();
    const { search, setSearch, spanFilterMatches } = useSearch(traceProp === null || traceProp === void 0 ? void 0 : traceProp.spans);
    const [focusedSpanIdForSearch, setFocusedSpanIdForSearch] = useState('');
    const [showSpanFilters, setShowSpanFilters] = useToggle(false);
    const [showSpanFilterMatchesOnly, setShowSpanFilterMatchesOnly] = useState(false);
    const [headerHeight, setHeaderHeight] = useState(100);
    const styles = useStyles2(getStyles);
    /**
     * Keeps state of resizable name column width
     */
    const [spanNameColumnWidth, setSpanNameColumnWidth] = useState(0.4);
    const [focusedSpanId, createFocusSpanLink] = useFocusSpanLink({
        refId: (_a = props.dataFrames[0]) === null || _a === void 0 ? void 0 : _a.refId,
        exploreId: props.exploreId,
        datasource,
        splitOpenFn: props.splitOpenFn,
    });
    const traceTimeline = useMemo(() => {
        var _a;
        return ({
            childrenHiddenIDs,
            detailStates,
            hoverIndentGuideIds,
            spanNameColumnWidth,
            traceID: (_a = props.traceProp) === null || _a === void 0 ? void 0 : _a.traceID,
        });
    }, [childrenHiddenIDs, detailStates, hoverIndentGuideIds, spanNameColumnWidth, (_b = props.traceProp) === null || _b === void 0 ? void 0 : _b.traceID]);
    const instanceSettings = getDatasourceSrv().getInstanceSettings(datasource === null || datasource === void 0 ? void 0 : datasource.name);
    const traceToLogsOptions = getTraceToLogsOptions(instanceSettings === null || instanceSettings === void 0 ? void 0 : instanceSettings.jsonData);
    const traceToMetrics = instanceSettings === null || instanceSettings === void 0 ? void 0 : instanceSettings.jsonData;
    const traceToMetricsOptions = traceToMetrics === null || traceToMetrics === void 0 ? void 0 : traceToMetrics.tracesToMetrics;
    const spanBarOptions = instanceSettings === null || instanceSettings === void 0 ? void 0 : instanceSettings.jsonData;
    const createSpanLink = useMemo(() => createSpanLinkFromProps !== null && createSpanLinkFromProps !== void 0 ? createSpanLinkFromProps : createSpanLinkFactory({
        splitOpenFn: props.splitOpenFn,
        traceToLogsOptions,
        traceToMetricsOptions,
        dataFrame: props.dataFrames[0],
        createFocusSpanLink,
        trace: traceProp,
    }), [
        props.splitOpenFn,
        traceToLogsOptions,
        traceToMetricsOptions,
        props.dataFrames,
        createFocusSpanLink,
        traceProp,
        createSpanLinkFromProps,
    ]);
    const timeZone = useSelector((state) => getTimeZone(state.user));
    const datasourceType = datasource ? datasource === null || datasource === void 0 ? void 0 : datasource.type : 'unknown';
    const scrollElement = props.scrollElement
        ? props.scrollElement
        : document.getElementsByClassName((_c = props.scrollElementClass) !== null && _c !== void 0 ? _c : '')[0];
    return (React.createElement(React.Fragment, null, ((_d = props.dataFrames) === null || _d === void 0 ? void 0 : _d.length) && traceProp ? (React.createElement(React.Fragment, null,
        React.createElement(TracePageHeader, { trace: traceProp, data: props.dataFrames[0], timeZone: timeZone, search: search, setSearch: setSearch, showSpanFilters: showSpanFilters, setShowSpanFilters: setShowSpanFilters, showSpanFilterMatchesOnly: showSpanFilterMatchesOnly, setShowSpanFilterMatchesOnly: setShowSpanFilterMatchesOnly, setFocusedSpanIdForSearch: setFocusedSpanIdForSearch, spanFilterMatches: spanFilterMatches, datasourceType: datasourceType, setHeaderHeight: setHeaderHeight, app: exploreId ? CoreApp.Explore : CoreApp.Unknown }),
        React.createElement(SpanGraph, { trace: traceProp, viewRange: viewRange, updateNextViewRangeTime: updateNextViewRangeTime, updateViewRangeTime: updateViewRangeTime }),
        React.createElement(TraceTimelineViewer, { findMatchesIDs: spanFilterMatches, trace: traceProp, datasourceType: datasourceType, spanBarOptions: spanBarOptions === null || spanBarOptions === void 0 ? void 0 : spanBarOptions.spanBar, traceTimeline: traceTimeline, updateNextViewRangeTime: updateNextViewRangeTime, updateViewRangeTime: updateViewRangeTime, viewRange: viewRange, timeZone: timeZone, setSpanNameColumnWidth: setSpanNameColumnWidth, collapseAll: collapseAll, collapseOne: collapseOne, expandAll: expandAll, expandOne: expandOne, childrenToggle: childrenToggle, detailLogItemToggle: detailLogItemToggle, detailLogsToggle: detailLogsToggle, detailWarningsToggle: detailWarningsToggle, detailStackTracesToggle: detailStackTracesToggle, detailReferencesToggle: detailReferencesToggle, detailReferenceItemToggle: detailReferenceItemToggle, detailProcessToggle: detailProcessToggle, detailTagsToggle: detailTagsToggle, detailToggle: toggleDetail, addHoverIndentGuideId: addHoverIndentGuideId, removeHoverIndentGuideId: removeHoverIndentGuideId, linksGetter: () => [], createSpanLink: createSpanLink, scrollElement: scrollElement, focusedSpanId: focusedSpanId, focusedSpanIdForSearch: focusedSpanIdForSearch, showSpanFilterMatchesOnly: showSpanFilterMatchesOnly, createFocusSpanLink: createFocusSpanLink, topOfViewRef: topOfViewRef, topOfViewRefType: topOfViewRefType, headerHeight: headerHeight }))) : (React.createElement("div", { className: styles.noDataMsg }, "No data"))));
}
/**
 * Handles focusing a span. Returns the span id to focus to based on what is in current explore state and also a
 * function to change the focused span id.
 * @param options
 */
function useFocusSpanLink(options) {
    const panelState = useSelector((state) => { var _a; return (_a = state.explore.panes[options.exploreId]) === null || _a === void 0 ? void 0 : _a.panelsState.trace; });
    const focusedSpanId = panelState === null || panelState === void 0 ? void 0 : panelState.spanId;
    const dispatch = useDispatch();
    const setFocusedSpanId = (spanId) => dispatch(changePanelState(options.exploreId, 'trace', Object.assign(Object.assign({}, panelState), { spanId })));
    const query = useSelector((state) => { var _a; return (_a = state.explore.panes[options.exploreId]) === null || _a === void 0 ? void 0 : _a.queries.find((query) => query.refId === options.refId); });
    const createFocusSpanLink = (traceId, spanId) => {
        var _a, _b;
        const link = {
            title: 'Deep link to this span',
            url: '',
            internal: {
                datasourceUid: (_a = options.datasource) === null || _a === void 0 ? void 0 : _a.uid,
                datasourceName: (_b = options.datasource) === null || _b === void 0 ? void 0 : _b.name,
                query: Object.assign(Object.assign({}, query), { query: traceId }),
                panelsState: {
                    trace: {
                        spanId,
                    },
                },
            },
        };
        // Check if the link is to a different trace or not.
        // If it's the same trace, only update panel state with setFocusedSpanId (no navigation).
        // If it's a different trace, use splitOpenFn to open a new explore panel
        const sameTrace = (query === null || query === void 0 ? void 0 : query.queryType) === 'traceql' && query.query === traceId;
        return mapInternalLinkToExplore({
            link,
            internalLink: link.internal,
            scopedVars: {},
            field: {},
            onClickFn: sameTrace
                ? () => setFocusedSpanId(focusedSpanId === spanId ? undefined : spanId)
                : options.splitOpenFn
                    ? () => {
                        var _a;
                        return options.splitOpenFn({
                            datasourceUid: (_a = options.datasource) === null || _a === void 0 ? void 0 : _a.uid,
                            queries: [
                                Object.assign(Object.assign({}, query), { query: traceId }),
                            ],
                            panelsState: {
                                trace: {
                                    spanId,
                                },
                            },
                        });
                    }
                    : undefined,
            replaceVariables: getTemplateSrv().replace.bind(getTemplateSrv()),
        });
    };
    return [focusedSpanId, createFocusSpanLink];
}
//# sourceMappingURL=TraceView.js.map