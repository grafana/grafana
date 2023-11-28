// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
import { css } from '@emotion/css';
import { isEqual } from 'lodash';
import memoizeOne from 'memoize-one';
import * as React from 'react';
import { config, reportInteraction } from '@grafana/runtime';
import { stylesFactory, withTheme2, ToolbarButton } from '@grafana/ui';
import { PEER_SERVICE } from '../constants/tag-keys';
import { getColorByKey } from '../utils/color-generator';
import ListView from './ListView';
import SpanBarRow from './SpanBarRow';
import SpanDetailRow from './SpanDetailRow';
import { createViewedBoundsFunc, findServerChildSpan, isErrorSpan, isKindClient, spanContainsErredSpan, } from './utils';
const getStyles = stylesFactory((props) => {
    const { topOfViewRefType } = props;
    const position = topOfViewRefType === TopOfViewRefType.Explore ? 'fixed' : 'absolute';
    return {
        rowsWrapper: css `
      width: 100%;
    `,
        row: css `
      width: 100%;
    `,
        scrollToTopButton: css `
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      width: 40px;
      height: 40px;
      position: ${position};
      bottom: 30px;
      right: 30px;
      z-index: 1;
    `,
    };
});
export var TopOfViewRefType;
(function (TopOfViewRefType) {
    TopOfViewRefType["Explore"] = "Explore";
    TopOfViewRefType["Panel"] = "Panel";
})(TopOfViewRefType || (TopOfViewRefType = {}));
// export for tests
export const DEFAULT_HEIGHTS = {
    bar: 28,
    detail: 161,
    detailWithLogs: 197,
};
const NUM_TICKS = 5;
const BUFFER_SIZE = 33;
function generateRowStates(spans, childrenHiddenIDs, detailStates, findMatchesIDs, showSpanFilterMatchesOnly) {
    if (!spans) {
        return [];
    }
    if (showSpanFilterMatchesOnly && findMatchesIDs) {
        spans = spans.filter((span) => findMatchesIDs.has(span.spanID));
    }
    let collapseDepth = null;
    const rowStates = [];
    for (let i = 0; i < spans.length; i++) {
        const span = spans[i];
        const { spanID, depth } = span;
        let hidden = false;
        if (collapseDepth != null) {
            if (depth >= collapseDepth) {
                hidden = true;
            }
            else {
                collapseDepth = null;
            }
        }
        if (hidden) {
            continue;
        }
        if (childrenHiddenIDs.has(spanID)) {
            collapseDepth = depth + 1;
        }
        rowStates.push({
            span,
            isDetail: false,
            spanIndex: i,
        });
        if (detailStates.has(spanID)) {
            rowStates.push({
                span,
                isDetail: true,
                spanIndex: i,
            });
        }
    }
    return rowStates;
}
function getClipping(currentViewRange) {
    const [zoomStart, zoomEnd] = currentViewRange;
    return {
        left: zoomStart > 0,
        right: zoomEnd < 1,
    };
}
function generateRowStatesFromTrace(trace, childrenHiddenIDs, detailStates, findMatchesIDs, showSpanFilterMatchesOnly) {
    return trace
        ? generateRowStates(trace.spans, childrenHiddenIDs, detailStates, findMatchesIDs, showSpanFilterMatchesOnly)
        : [];
}
const memoizedGenerateRowStates = memoizeOne(generateRowStatesFromTrace);
const memoizedViewBoundsFunc = memoizeOne(createViewedBoundsFunc, isEqual);
const memoizedGetClipping = memoizeOne(getClipping, isEqual);
// export from tests
export class UnthemedVirtualizedTraceView extends React.Component {
    constructor() {
        super(...arguments);
        this.hasScrolledToSpan = false;
        this.getViewRange = () => this.props.currentViewRangeTime;
        this.getSearchedSpanIDs = () => this.props.findMatchesIDs;
        this.getCollapsedChildren = () => this.props.childrenHiddenIDs;
        this.mapRowIndexToSpanIndex = (index) => this.getRowStates()[index].spanIndex;
        this.mapSpanIndexToRowIndex = (index) => {
            const max = this.getRowStates().length;
            for (let i = 0; i < max; i++) {
                const { spanIndex } = this.getRowStates()[i];
                if (spanIndex === index) {
                    return i;
                }
            }
            throw new Error(`unable to find row for span index: ${index}`);
        };
        this.setListView = (listView) => {
            this.listView = listView;
        };
        // use long form syntax to avert flow error
        // https://github.com/facebook/flow/issues/3076#issuecomment-290944051
        this.getKeyFromIndex = (index) => {
            const { isDetail, span } = this.getRowStates()[index];
            return `${span.traceID}--${span.spanID}--${isDetail ? 'detail' : 'bar'}`;
        };
        this.getIndexFromKey = (key) => {
            const parts = key.split('--');
            const _traceID = parts[0];
            const _spanID = parts[1];
            const _isDetail = parts[2] === 'detail';
            const max = this.getRowStates().length;
            for (let i = 0; i < max; i++) {
                const { span, isDetail } = this.getRowStates()[i];
                if (span.spanID === _spanID && span.traceID === _traceID && isDetail === _isDetail) {
                    return i;
                }
            }
            return -1;
        };
        this.getRowHeight = (index) => {
            const { span, isDetail } = this.getRowStates()[index];
            if (!isDetail) {
                return DEFAULT_HEIGHTS.bar;
            }
            if (Array.isArray(span.logs) && span.logs.length) {
                return DEFAULT_HEIGHTS.detailWithLogs;
            }
            return DEFAULT_HEIGHTS.detail;
        };
        this.renderRow = (key, style, index, attrs) => {
            var _a, _b;
            const { isDetail, span, spanIndex } = this.getRowStates()[index];
            // Compute the list of currently visible span IDs to pass to the row renderers.
            const start = Math.max((((_a = this.listView) === null || _a === void 0 ? void 0 : _a.getTopVisibleIndex()) || 0) - BUFFER_SIZE, 0);
            const end = (((_b = this.listView) === null || _b === void 0 ? void 0 : _b.getBottomVisibleIndex()) || 0) + BUFFER_SIZE;
            const visibleSpanIds = this.getVisibleSpanIds(start, end);
            return isDetail
                ? this.renderSpanDetailRow(span, key, style, attrs, visibleSpanIds)
                : this.renderSpanBarRow(span, spanIndex, key, style, attrs, visibleSpanIds);
        };
        this.scrollToSpan = (headerHeight, spanID) => {
            var _a;
            if (spanID == null) {
                return;
            }
            const i = this.getRowStates().findIndex((row) => row.span.spanID === spanID);
            if (i >= 0) {
                (_a = this.listView) === null || _a === void 0 ? void 0 : _a.scrollToIndex(i, headerHeight);
            }
        };
        this.scrollToTop = () => {
            var _a;
            const { topOfViewRef, datasourceType, trace } = this.props;
            (_a = topOfViewRef === null || topOfViewRef === void 0 ? void 0 : topOfViewRef.current) === null || _a === void 0 ? void 0 : _a.scrollIntoView({ behavior: 'smooth' });
            reportInteraction('grafana_traces_trace_view_scroll_to_top_clicked', {
                datasourceType: datasourceType,
                grafana_version: config.buildInfo.version,
                numServices: trace.services.length,
                numSpans: trace.spans.length,
            });
        };
        this.getVisibleSpanIds = memoizeOne((start, end) => {
            const spanIds = [];
            for (let i = start; i < end; i++) {
                const rowState = this.getRowStates()[i];
                if (rowState === null || rowState === void 0 ? void 0 : rowState.span) {
                    spanIds.push(rowState.span.spanID);
                }
            }
            return spanIds;
        });
    }
    componentDidMount() {
        this.scrollToSpan(this.props.headerHeight, this.props.focusedSpanId);
    }
    shouldComponentUpdate(nextProps) {
        // If any prop updates, VirtualizedTraceViewImpl should update.
        let key;
        for (key in nextProps) {
            if (nextProps[key] !== this.props[key]) {
                return true;
            }
        }
        return false;
    }
    componentDidUpdate(prevProps) {
        const { headerHeight, focusedSpanId, focusedSpanIdForSearch } = this.props;
        if (!this.hasScrolledToSpan) {
            this.scrollToSpan(headerHeight, focusedSpanId);
            this.hasScrolledToSpan = true;
        }
        if (focusedSpanId !== prevProps.focusedSpanId) {
            this.scrollToSpan(headerHeight, focusedSpanId);
        }
        if (focusedSpanIdForSearch !== prevProps.focusedSpanIdForSearch) {
            this.scrollToSpan(headerHeight, focusedSpanIdForSearch);
        }
    }
    getRowStates() {
        const { childrenHiddenIDs, detailStates, trace, findMatchesIDs, showSpanFilterMatchesOnly } = this.props;
        return memoizedGenerateRowStates(trace, childrenHiddenIDs, detailStates, findMatchesIDs, showSpanFilterMatchesOnly);
    }
    getClipping() {
        const { currentViewRangeTime } = this.props;
        return memoizedGetClipping(currentViewRangeTime);
    }
    getViewedBounds() {
        const { currentViewRangeTime, trace } = this.props;
        const [zoomStart, zoomEnd] = currentViewRangeTime;
        return memoizedViewBoundsFunc({
            min: trace.startTime,
            max: trace.endTime,
            viewStart: zoomStart,
            viewEnd: zoomEnd,
        });
    }
    getAccessors() {
        const lv = this.listView;
        if (!lv) {
            throw new Error('ListView unavailable');
        }
        return {
            getViewRange: this.getViewRange,
            getSearchedSpanIDs: this.getSearchedSpanIDs,
            getCollapsedChildren: this.getCollapsedChildren,
            getViewHeight: lv.getViewHeight,
            getBottomRowIndexVisible: lv.getBottomVisibleIndex,
            getTopRowIndexVisible: lv.getTopVisibleIndex,
            getRowPosition: lv.getRowPosition,
            mapRowIndexToSpanIndex: this.mapRowIndexToSpanIndex,
            mapSpanIndexToRowIndex: this.mapSpanIndexToRowIndex,
        };
    }
    renderSpanBarRow(span, spanIndex, key, style, attrs, visibleSpanIds) {
        const { spanID } = span;
        const { serviceName } = span.process;
        const { childrenHiddenIDs, childrenToggle, detailStates, detailToggle, findMatchesIDs, spanNameColumnWidth, trace, spanBarOptions, hoverIndentGuideIds, addHoverIndentGuideId, removeHoverIndentGuideId, createSpanLink, focusedSpanId, focusedSpanIdForSearch, showSpanFilterMatchesOnly, theme, datasourceType, } = this.props;
        // to avert flow error
        if (!trace) {
            return null;
        }
        const color = getColorByKey(serviceName, theme);
        const isCollapsed = childrenHiddenIDs.has(spanID);
        const isDetailExpanded = detailStates.has(spanID);
        const isMatchingFilter = findMatchesIDs ? findMatchesIDs.has(spanID) : false;
        const isFocused = spanID === focusedSpanId || spanID === focusedSpanIdForSearch;
        const showErrorIcon = isErrorSpan(span) || (isCollapsed && spanContainsErredSpan(trace.spans, spanIndex));
        // Check for direct child "server" span if the span is a "client" span.
        let rpc = null;
        if (isCollapsed) {
            const rpcSpan = findServerChildSpan(trace.spans.slice(spanIndex));
            if (rpcSpan) {
                const rpcViewBounds = this.getViewedBounds()(rpcSpan.startTime, rpcSpan.startTime + rpcSpan.duration);
                rpc = {
                    color: getColorByKey(rpcSpan.process.serviceName, theme),
                    operationName: rpcSpan.operationName,
                    serviceName: rpcSpan.process.serviceName,
                    viewEnd: rpcViewBounds.end,
                    viewStart: rpcViewBounds.start,
                };
            }
        }
        const peerServiceKV = span.tags.find((kv) => kv.key === PEER_SERVICE);
        // Leaf, kind == client and has peer.service.tag, is likely a client span that does a request
        // to an uninstrumented/external service
        let noInstrumentedServer = null;
        if (!span.hasChildren && peerServiceKV && isKindClient(span)) {
            noInstrumentedServer = {
                serviceName: peerServiceKV.value,
                color: getColorByKey(peerServiceKV.value, theme),
            };
        }
        const prevSpan = spanIndex > 0 ? trace.spans[spanIndex - 1] : null;
        const styles = getStyles(this.props);
        return (React.createElement("div", Object.assign({ className: styles.row, key: key, style: style }, attrs),
            React.createElement(SpanBarRow, { clippingLeft: this.getClipping().left, clippingRight: this.getClipping().right, color: color, spanBarOptions: spanBarOptions, columnDivision: spanNameColumnWidth, isChildrenExpanded: !isCollapsed, isDetailExpanded: isDetailExpanded, isMatchingFilter: isMatchingFilter, isFocused: isFocused, showSpanFilterMatchesOnly: showSpanFilterMatchesOnly, numTicks: NUM_TICKS, onDetailToggled: detailToggle, onChildrenToggled: childrenToggle, rpc: rpc, noInstrumentedServer: noInstrumentedServer, showErrorIcon: showErrorIcon, getViewedBounds: this.getViewedBounds(), traceStartTime: trace.startTime, span: span, hoverIndentGuideIds: hoverIndentGuideIds, addHoverIndentGuideId: addHoverIndentGuideId, removeHoverIndentGuideId: removeHoverIndentGuideId, createSpanLink: createSpanLink, datasourceType: datasourceType, showServiceName: prevSpan === null || prevSpan.process.serviceName !== span.process.serviceName, visibleSpanIds: visibleSpanIds })));
    }
    renderSpanDetailRow(span, key, style, attrs, visibleSpanIds) {
        const { spanID } = span;
        const { serviceName } = span.process;
        const { detailLogItemToggle, detailLogsToggle, detailProcessToggle, detailReferencesToggle, detailReferenceItemToggle, detailWarningsToggle, detailStackTracesToggle, detailStates, detailTagsToggle, detailToggle, spanNameColumnWidth, trace, timeZone, hoverIndentGuideIds, addHoverIndentGuideId, removeHoverIndentGuideId, linksGetter, createSpanLink, focusedSpanId, createFocusSpanLink, topOfViewRefType, theme, datasourceType, } = this.props;
        const detailState = detailStates.get(spanID);
        if (!trace || !detailState) {
            return null;
        }
        const color = getColorByKey(serviceName, theme);
        const styles = getStyles(this.props);
        return (React.createElement("div", Object.assign({ className: styles.row, key: key, style: Object.assign(Object.assign({}, style), { zIndex: 1 }) }, attrs),
            React.createElement(SpanDetailRow, { color: color, columnDivision: spanNameColumnWidth, onDetailToggled: detailToggle, detailState: detailState, linksGetter: linksGetter, logItemToggle: detailLogItemToggle, logsToggle: detailLogsToggle, processToggle: detailProcessToggle, referenceItemToggle: detailReferenceItemToggle, referencesToggle: detailReferencesToggle, warningsToggle: detailWarningsToggle, stackTracesToggle: detailStackTracesToggle, span: span, timeZone: timeZone, tagsToggle: detailTagsToggle, traceStartTime: trace.startTime, hoverIndentGuideIds: hoverIndentGuideIds, addHoverIndentGuideId: addHoverIndentGuideId, removeHoverIndentGuideId: removeHoverIndentGuideId, createSpanLink: createSpanLink, focusedSpanId: focusedSpanId, createFocusSpanLink: createFocusSpanLink, topOfViewRefType: topOfViewRefType, datasourceType: datasourceType, visibleSpanIds: visibleSpanIds })));
    }
    render() {
        const styles = getStyles(this.props);
        const { scrollElement } = this.props;
        return (React.createElement(React.Fragment, null,
            React.createElement(ListView, { ref: this.setListView, dataLength: this.getRowStates().length, itemHeightGetter: this.getRowHeight, itemRenderer: this.renderRow, viewBuffer: BUFFER_SIZE, viewBufferMin: BUFFER_SIZE, itemsWrapperClassName: styles.rowsWrapper, getKeyFromIndex: this.getKeyFromIndex, getIndexFromKey: this.getIndexFromKey, windowScroller: false, scrollElement: scrollElement }),
            React.createElement(ToolbarButton, { className: styles.scrollToTopButton, onClick: this.scrollToTop, title: "Scroll to top", icon: "arrow-up" })));
    }
}
export default withTheme2(UnthemedVirtualizedTraceView);
//# sourceMappingURL=VirtualizedTraceView.js.map