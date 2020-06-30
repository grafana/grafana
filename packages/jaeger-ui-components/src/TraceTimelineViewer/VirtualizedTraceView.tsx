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

import * as React from 'react';
import { css } from 'emotion';

import ListView from './ListView';
import SpanBarRow from './SpanBarRow';
import DetailState from './SpanDetail/DetailState';
import SpanDetailRow from './SpanDetailRow';
import {
  createViewedBoundsFunc,
  findServerChildSpan,
  isErrorSpan,
  spanContainsErredSpan,
  ViewedBoundsFunctionType,
} from './utils';
import { Accessors } from '../ScrollManager';
import { getColorByKey } from '../utils/color-generator';
import { TNil } from '../types';
import { TraceLog, TraceSpan, Trace, TraceKeyValuePair, TraceLink } from '@grafana/data';
import TTraceTimeline from '../types/TTraceTimeline';

import { createStyle, Theme, withTheme } from '../Theme';

type TExtractUiFindFromStateReturn = {
  uiFind: string | undefined;
};

const getStyles = createStyle(() => {
  return {
    rowsWrapper: css`
      width: 100%;
    `,
    row: css`
      width: 100%;
    `,
  };
});

type RowState = {
  isDetail: boolean;
  span: TraceSpan;
  spanIndex: number;
};

type TVirtualizedTraceViewOwnProps = {
  currentViewRangeTime: [number, number];
  findMatchesIDs: Set<string> | TNil;
  scrollToFirstVisibleSpan: () => void;
  registerAccessors: (accesors: Accessors) => void;
  trace: Trace;
  focusSpan: (uiFind: string) => void;
  linksGetter: (span: TraceSpan, items: TraceKeyValuePair[], itemIndex: number) => TraceLink[];
  childrenToggle: (spanID: string) => void;
  clearShouldScrollToFirstUiFindMatch: () => void;
  detailLogItemToggle: (spanID: string, log: TraceLog) => void;
  detailLogsToggle: (spanID: string) => void;
  detailWarningsToggle: (spanID: string) => void;
  detailReferencesToggle: (spanID: string) => void;
  detailProcessToggle: (spanID: string) => void;
  detailTagsToggle: (spanID: string) => void;
  detailToggle: (spanID: string) => void;
  setSpanNameColumnWidth: (width: number) => void;
  setTrace: (trace: Trace | TNil, uiFind: string | TNil) => void;
  hoverIndentGuideIds: Set<string>;
  addHoverIndentGuideId: (spanID: string) => void;
  removeHoverIndentGuideId: (spanID: string) => void;
  theme: Theme;
};

type VirtualizedTraceViewProps = TVirtualizedTraceViewOwnProps & TExtractUiFindFromStateReturn & TTraceTimeline;

// export for tests
export const DEFAULT_HEIGHTS = {
  bar: 28,
  detail: 161,
  detailWithLogs: 197,
};

const NUM_TICKS = 5;

function generateRowStates(
  spans: TraceSpan[] | TNil,
  childrenHiddenIDs: Set<string>,
  detailStates: Map<string, DetailState | TNil>
): RowState[] {
  if (!spans) {
    return [];
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
      } else {
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

function getClipping(currentViewRange: [number, number]) {
  const [zoomStart, zoomEnd] = currentViewRange;
  return {
    left: zoomStart > 0,
    right: zoomEnd < 1,
  };
}

// export from tests
export class UnthemedVirtualizedTraceView extends React.Component<VirtualizedTraceViewProps> {
  clipping: { left: boolean; right: boolean };
  listView: ListView | TNil;
  rowStates: RowState[];
  getViewedBounds: ViewedBoundsFunctionType;

  constructor(props: VirtualizedTraceViewProps) {
    super(props);
    // keep "prop derivations" on the instance instead of calculating in
    // `.render()` to avoid recalculating in every invocation of `.renderRow()`
    const { currentViewRangeTime, childrenHiddenIDs, detailStates, setTrace, trace, uiFind } = props;
    this.clipping = getClipping(currentViewRangeTime);
    const [zoomStart, zoomEnd] = currentViewRangeTime;
    this.getViewedBounds = createViewedBoundsFunc({
      min: trace.startTime,
      max: trace.endTime,
      viewStart: zoomStart,
      viewEnd: zoomEnd,
    });
    this.rowStates = generateRowStates(trace.spans, childrenHiddenIDs, detailStates);

    setTrace(trace, uiFind);
  }

  shouldComponentUpdate(nextProps: VirtualizedTraceViewProps) {
    // If any prop updates, VirtualizedTraceViewImpl should update.
    const nextPropKeys = Object.keys(nextProps) as Array<keyof VirtualizedTraceViewProps>;
    for (let i = 0; i < nextPropKeys.length; i += 1) {
      if (nextProps[nextPropKeys[i]] !== this.props[nextPropKeys[i]]) {
        // Unless the only change was props.shouldScrollToFirstUiFindMatch changing to false.
        if (nextPropKeys[i] === 'shouldScrollToFirstUiFindMatch') {
          if (nextProps[nextPropKeys[i]]) {
            return true;
          }
        } else {
          return true;
        }
      }
    }
    return false;
  }

  componentWillUpdate(nextProps: VirtualizedTraceViewProps) {
    const { childrenHiddenIDs, detailStates, registerAccessors, trace, currentViewRangeTime } = this.props;
    const {
      currentViewRangeTime: nextViewRangeTime,
      childrenHiddenIDs: nextHiddenIDs,
      detailStates: nextDetailStates,
      registerAccessors: nextRegisterAccessors,
      setTrace,
      trace: nextTrace,
      uiFind,
    } = nextProps;
    if (trace !== nextTrace) {
      setTrace(nextTrace, uiFind);
    }
    if (trace !== nextTrace || childrenHiddenIDs !== nextHiddenIDs || detailStates !== nextDetailStates) {
      this.rowStates = nextTrace ? generateRowStates(nextTrace.spans, nextHiddenIDs, nextDetailStates) : [];
    }
    if (currentViewRangeTime !== nextViewRangeTime || (trace !== nextTrace && nextTrace)) {
      this.clipping = getClipping(nextViewRangeTime);
      const [zoomStart, zoomEnd] = nextViewRangeTime;
      this.getViewedBounds = createViewedBoundsFunc({
        min: nextTrace.startTime,
        max: nextTrace.endTime,
        viewStart: zoomStart,
        viewEnd: zoomEnd,
      });
    }
    if (this.listView && registerAccessors !== nextRegisterAccessors) {
      nextRegisterAccessors(this.getAccessors());
    }
  }

  componentDidUpdate() {
    const {
      shouldScrollToFirstUiFindMatch,
      clearShouldScrollToFirstUiFindMatch,
      scrollToFirstVisibleSpan,
    } = this.props;
    if (shouldScrollToFirstUiFindMatch) {
      scrollToFirstVisibleSpan();
      clearShouldScrollToFirstUiFindMatch();
    }
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

  getViewRange = () => this.props.currentViewRangeTime;

  getSearchedSpanIDs = () => this.props.findMatchesIDs;

  getCollapsedChildren = () => this.props.childrenHiddenIDs;

  mapRowIndexToSpanIndex = (index: number) => this.rowStates[index].spanIndex;

  mapSpanIndexToRowIndex = (index: number) => {
    const max = this.rowStates.length;
    for (let i = 0; i < max; i++) {
      const { spanIndex } = this.rowStates[i];
      if (spanIndex === index) {
        return i;
      }
    }
    throw new Error(`unable to find row for span index: ${index}`);
  };

  setListView = (listView: ListView | TNil) => {
    const isChanged = this.listView !== listView;
    this.listView = listView;
    if (listView && isChanged) {
      this.props.registerAccessors(this.getAccessors());
    }
  };

  // use long form syntax to avert flow error
  // https://github.com/facebook/flow/issues/3076#issuecomment-290944051
  getKeyFromIndex = (index: number) => {
    const { isDetail, span } = this.rowStates[index];
    return `${span.spanID}--${isDetail ? 'detail' : 'bar'}`;
  };

  getIndexFromKey = (key: string) => {
    const parts = key.split('--');
    const _spanID = parts[0];
    const _isDetail = parts[1] === 'detail';
    const max = this.rowStates.length;
    for (let i = 0; i < max; i++) {
      const { span, isDetail } = this.rowStates[i];
      if (span.spanID === _spanID && isDetail === _isDetail) {
        return i;
      }
    }
    return -1;
  };

  getRowHeight = (index: number) => {
    const { span, isDetail } = this.rowStates[index];
    if (!isDetail) {
      return DEFAULT_HEIGHTS.bar;
    }
    if (Array.isArray(span.logs) && span.logs.length) {
      return DEFAULT_HEIGHTS.detailWithLogs;
    }
    return DEFAULT_HEIGHTS.detail;
  };

  renderRow = (key: string, style: React.CSSProperties, index: number, attrs: {}) => {
    const { isDetail, span, spanIndex } = this.rowStates[index];
    return isDetail
      ? this.renderSpanDetailRow(span, key, style, attrs)
      : this.renderSpanBarRow(span, spanIndex, key, style, attrs);
  };

  renderSpanBarRow(span: TraceSpan, spanIndex: number, key: string, style: React.CSSProperties, attrs: {}) {
    const { spanID } = span;
    const { serviceName } = span.process;
    const {
      childrenHiddenIDs,
      childrenToggle,
      detailStates,
      detailToggle,
      findMatchesIDs,
      spanNameColumnWidth,
      trace,
      focusSpan,
      hoverIndentGuideIds,
      addHoverIndentGuideId,
      removeHoverIndentGuideId,
      theme,
    } = this.props;
    // to avert flow error
    if (!trace) {
      return null;
    }
    const color = getColorByKey(serviceName, theme);
    const isCollapsed = childrenHiddenIDs.has(spanID);
    const isDetailExpanded = detailStates.has(spanID);
    const isMatchingFilter = findMatchesIDs ? findMatchesIDs.has(spanID) : false;
    const showErrorIcon = isErrorSpan(span) || (isCollapsed && spanContainsErredSpan(trace.spans, spanIndex));

    // Check for direct child "server" span if the span is a "client" span.
    let rpc = null;
    if (isCollapsed) {
      const rpcSpan = findServerChildSpan(trace.spans.slice(spanIndex));
      if (rpcSpan) {
        const rpcViewBounds = this.getViewedBounds(rpcSpan.startTime, rpcSpan.startTime + rpcSpan.duration);
        rpc = {
          color: getColorByKey(rpcSpan.process.serviceName, theme),
          operationName: rpcSpan.operationName,
          serviceName: rpcSpan.process.serviceName,
          viewEnd: rpcViewBounds.end,
          viewStart: rpcViewBounds.start,
        };
      }
    }
    const styles = getStyles();
    return (
      <div className={styles.row} key={key} style={style} {...attrs}>
        <SpanBarRow
          clippingLeft={this.clipping.left}
          clippingRight={this.clipping.right}
          color={color}
          columnDivision={spanNameColumnWidth}
          isChildrenExpanded={!isCollapsed}
          isDetailExpanded={isDetailExpanded}
          isMatchingFilter={isMatchingFilter}
          numTicks={NUM_TICKS}
          onDetailToggled={detailToggle}
          onChildrenToggled={childrenToggle}
          rpc={rpc}
          showErrorIcon={showErrorIcon}
          getViewedBounds={this.getViewedBounds}
          traceStartTime={trace.startTime}
          span={span}
          focusSpan={focusSpan}
          hoverIndentGuideIds={hoverIndentGuideIds}
          addHoverIndentGuideId={addHoverIndentGuideId}
          removeHoverIndentGuideId={removeHoverIndentGuideId}
        />
      </div>
    );
  }

  renderSpanDetailRow(span: TraceSpan, key: string, style: React.CSSProperties, attrs: {}) {
    const { spanID } = span;
    const { serviceName } = span.process;
    const {
      detailLogItemToggle,
      detailLogsToggle,
      detailProcessToggle,
      detailReferencesToggle,
      detailWarningsToggle,
      detailStates,
      detailTagsToggle,
      detailToggle,
      spanNameColumnWidth,
      trace,
      focusSpan,
      hoverIndentGuideIds,
      addHoverIndentGuideId,
      removeHoverIndentGuideId,
      linksGetter,
      theme,
    } = this.props;
    const detailState = detailStates.get(spanID);
    if (!trace || !detailState) {
      return null;
    }
    const color = getColorByKey(serviceName, theme);
    const styles = getStyles();
    return (
      <div className={styles.row} key={key} style={{ ...style, zIndex: 1 }} {...attrs}>
        <SpanDetailRow
          color={color}
          columnDivision={spanNameColumnWidth}
          onDetailToggled={detailToggle}
          detailState={detailState}
          linksGetter={linksGetter}
          logItemToggle={detailLogItemToggle}
          logsToggle={detailLogsToggle}
          processToggle={detailProcessToggle}
          referencesToggle={detailReferencesToggle}
          warningsToggle={detailWarningsToggle}
          span={span}
          tagsToggle={detailTagsToggle}
          traceStartTime={trace.startTime}
          focusSpan={focusSpan}
          hoverIndentGuideIds={hoverIndentGuideIds}
          addHoverIndentGuideId={addHoverIndentGuideId}
          removeHoverIndentGuideId={removeHoverIndentGuideId}
        />
      </div>
    );
  }

  render() {
    const styles = getStyles();
    return (
      <div>
        <ListView
          ref={this.setListView}
          dataLength={this.rowStates.length}
          itemHeightGetter={this.getRowHeight}
          itemRenderer={this.renderRow}
          viewBuffer={300}
          viewBufferMin={100}
          itemsWrapperClassName={styles.rowsWrapper}
          getKeyFromIndex={this.getKeyFromIndex}
          getIndexFromKey={this.getIndexFromKey}
          windowScroller
        />
      </div>
    );
  }
}

export default withTheme(UnthemedVirtualizedTraceView);
