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
import { RefObject } from 'react';

import { GrafanaTheme2, LinkModel, TimeZone } from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';
import { stylesFactory, withTheme2, ToolbarButton } from '@grafana/ui';

import { Accessors } from '../ScrollManager';
import { PEER_SERVICE } from '../constants/tag-keys';
import { SpanBarOptions, SpanLinkFunc, TNil } from '../types';
import TTraceTimeline from '../types/TTraceTimeline';
import { TraceLog, TraceSpan, Trace, TraceKeyValuePair, TraceLink, TraceSpanReference } from '../types/trace';
import { getColorByKey } from '../utils/color-generator';

import ListView from './ListView';
import SpanBarRow from './SpanBarRow';
import DetailState from './SpanDetail/DetailState';
import SpanDetailRow from './SpanDetailRow';
import {
  createViewedBoundsFunc,
  findServerChildSpan,
  isErrorSpan,
  isKindClient,
  spanContainsErredSpan,
  ViewedBoundsFunctionType,
} from './utils';

type TExtractUiFindFromStateReturn = {
  uiFind: string | undefined;
};

const getStyles = stylesFactory((props: TVirtualizedTraceViewOwnProps) => {
  const { topOfViewRefType } = props;
  const position = topOfViewRefType === TopOfViewRefType.Explore ? 'fixed' : 'absolute';

  return {
    rowsWrapper: css`
      width: 100%;
    `,
    row: css`
      width: 100%;
    `,
    scrollToTopButton: css`
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

type RowState = {
  isDetail: boolean;
  span: TraceSpan;
  spanIndex: number;
};

export enum TopOfViewRefType {
  Explore = 'Explore',
  Panel = 'Panel',
}

type TVirtualizedTraceViewOwnProps = {
  currentViewRangeTime: [number, number];
  timeZone: TimeZone;
  findMatchesIDs: Set<string> | TNil;
  scrollToFirstVisibleSpan: () => void;
  registerAccessors: (accesors: Accessors) => void;
  trace: Trace;
  spanBarOptions: SpanBarOptions | undefined;
  linksGetter: (span: TraceSpan, items: TraceKeyValuePair[], itemIndex: number) => TraceLink[];
  childrenToggle: (spanID: string) => void;
  clearShouldScrollToFirstUiFindMatch: () => void;
  detailLogItemToggle: (spanID: string, log: TraceLog) => void;
  detailLogsToggle: (spanID: string) => void;
  detailWarningsToggle: (spanID: string) => void;
  detailStackTracesToggle: (spanID: string) => void;
  detailReferencesToggle: (spanID: string) => void;
  detailReferenceItemToggle: (spanID: string, reference: TraceSpanReference) => void;
  detailProcessToggle: (spanID: string) => void;
  detailTagsToggle: (spanID: string) => void;
  detailToggle: (spanID: string) => void;
  setSpanNameColumnWidth: (width: number) => void;
  setTrace: (trace: Trace | TNil, uiFind: string | TNil) => void;
  hoverIndentGuideIds: Set<string>;
  addHoverIndentGuideId: (spanID: string) => void;
  removeHoverIndentGuideId: (spanID: string) => void;
  theme: GrafanaTheme2;
  createSpanLink?: SpanLinkFunc;
  scrollElement?: Element;
  focusedSpanId?: string;
  focusedSpanIdForSearch: string;
  createFocusSpanLink: (traceId: string, spanId: string) => LinkModel;
  topOfViewRef?: RefObject<HTMLDivElement>;
  topOfViewRefType?: TopOfViewRefType;
  datasourceType: string;
  setSelectedSpan: React.Dispatch<React.SetStateAction<TraceSpan | undefined>>;
  selectedSpanId?: string;
};

export type VirtualizedTraceViewProps = TVirtualizedTraceViewOwnProps & TExtractUiFindFromStateReturn & TTraceTimeline;

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

function generateRowStatesFromTrace(
  trace: Trace | TNil,
  childrenHiddenIDs: Set<string>,
  detailStates: Map<string, DetailState | TNil>
): RowState[] {
  return trace ? generateRowStates(trace.spans, childrenHiddenIDs, detailStates) : [];
}

const memoizedGenerateRowStates = memoizeOne(generateRowStatesFromTrace);
const memoizedViewBoundsFunc = memoizeOne(createViewedBoundsFunc, isEqual);
const memoizedGetClipping = memoizeOne(getClipping, isEqual);

// export from tests
export class UnthemedVirtualizedTraceView extends React.Component<VirtualizedTraceViewProps> {
  listView: ListView | TNil;

  constructor(props: VirtualizedTraceViewProps) {
    super(props);
    const { setTrace, trace, uiFind } = props;
    setTrace(trace, uiFind);
  }

  componentDidMount() {
    this.scrollToSpan(this.props.focusedSpanId);
  }

  shouldComponentUpdate(nextProps: VirtualizedTraceViewProps) {
    // If any prop updates, VirtualizedTraceViewImpl should update.
    let key: keyof VirtualizedTraceViewProps;
    for (key in nextProps) {
      if (nextProps[key] !== this.props[key]) {
        // Unless the only change was props.shouldScrollToFirstUiFindMatch changing to false.
        if (key === 'shouldScrollToFirstUiFindMatch') {
          if (nextProps[key]) {
            return true;
          }
        } else {
          return true;
        }
      }
    }
    return false;
  }

  componentDidUpdate(prevProps: Readonly<VirtualizedTraceViewProps>) {
    const { registerAccessors, trace } = prevProps;
    const {
      shouldScrollToFirstUiFindMatch,
      clearShouldScrollToFirstUiFindMatch,
      scrollToFirstVisibleSpan,
      registerAccessors: nextRegisterAccessors,
      setTrace,
      trace: nextTrace,
      uiFind,
      focusedSpanId,
      focusedSpanIdForSearch,
    } = this.props;

    if (trace !== nextTrace) {
      setTrace(nextTrace, uiFind);
    }

    if (this.listView && registerAccessors !== nextRegisterAccessors) {
      nextRegisterAccessors(this.getAccessors());
    }

    if (shouldScrollToFirstUiFindMatch) {
      scrollToFirstVisibleSpan();
      clearShouldScrollToFirstUiFindMatch();
    }

    if (focusedSpanId !== prevProps.focusedSpanId) {
      this.scrollToSpan(focusedSpanId);
    }

    if (focusedSpanIdForSearch !== prevProps.focusedSpanIdForSearch) {
      this.scrollToSpan(focusedSpanIdForSearch);
    }
  }

  getRowStates(): RowState[] {
    const { childrenHiddenIDs, detailStates, trace } = this.props;
    return memoizedGenerateRowStates(trace, childrenHiddenIDs, detailStates);
  }

  getClipping(): { left: boolean; right: boolean } {
    const { currentViewRangeTime } = this.props;
    return memoizedGetClipping(currentViewRangeTime);
  }

  getViewedBounds(): ViewedBoundsFunctionType {
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

  getViewRange = () => this.props.currentViewRangeTime;

  getSearchedSpanIDs = () => this.props.findMatchesIDs;

  getCollapsedChildren = () => this.props.childrenHiddenIDs;

  mapRowIndexToSpanIndex = (index: number) => this.getRowStates()[index].spanIndex;

  mapSpanIndexToRowIndex = (index: number) => {
    const max = this.getRowStates().length;
    for (let i = 0; i < max; i++) {
      const { spanIndex } = this.getRowStates()[i];
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
    const { isDetail, span } = this.getRowStates()[index];
    return `${span.traceID}--${span.spanID}--${isDetail ? 'detail' : 'bar'}`;
  };

  getIndexFromKey = (key: string) => {
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

  getRowHeight = (index: number) => {
    const { span, isDetail } = this.getRowStates()[index];
    if (!isDetail) {
      return DEFAULT_HEIGHTS.bar;
    }
    if (Array.isArray(span.logs) && span.logs.length) {
      return DEFAULT_HEIGHTS.detailWithLogs;
    }
    return DEFAULT_HEIGHTS.detail;
  };

  renderRow = (key: string, style: React.CSSProperties, index: number, attrs: {}) => {
    const { isDetail, span, spanIndex } = this.getRowStates()[index];

    return isDetail ? null : this.renderSpanBarRow(span, spanIndex, key, style, attrs);
  };

  scrollToSpan = (spanID?: string) => {
    if (spanID == null) {
      return;
    }
    const i = this.getRowStates().findIndex((row) => row.span.spanID === spanID);
    if (i >= 0) {
      this.listView?.scrollToIndex(i);
    }
  };

  renderSpanBarRow(span: TraceSpan, spanIndex: number, key: string, style: React.CSSProperties, attrs: {}) {
    const { spanID } = span;
    const { serviceName } = span.process;
    const {
      childrenHiddenIDs,
      childrenToggle,
      findMatchesIDs,
      spanNameColumnWidth,
      trace,
      spanBarOptions,
      hoverIndentGuideIds,
      addHoverIndentGuideId,
      removeHoverIndentGuideId,
      createSpanLink,
      focusedSpanId,
      focusedSpanIdForSearch,
      theme,
      datasourceType,
      setSelectedSpan,
      selectedSpanId,
    } = this.props;
    // to avert flow error
    if (!trace) {
      return null;
    }
    const color = getColorByKey(serviceName, theme);
    const isCollapsed = childrenHiddenIDs.has(spanID);
    const isDetailExpanded = spanID === selectedSpanId;
    const isMatchingFilter = findMatchesIDs ? findMatchesIDs.has(spanID) : false;
    const isFocused = spanID === focusedSpanId || spanID === focusedSpanIdForSearch;
    const showErrorIcon = isErrorSpan(span) || (isCollapsed && spanContainsErredSpan(trace.spans, spanIndex));

    const { span: prevSpan } = this.getRowStates()[spanIndex > 1 ? spanIndex - 1 : 0];

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

    const styles = getStyles(this.props);
    return (
      <div className={styles.row} key={key} style={style} {...attrs}>
        <SpanBarRow
          clippingLeft={this.getClipping().left}
          clippingRight={this.getClipping().right}
          color={color}
          spanBarOptions={spanBarOptions}
          columnDivision={spanNameColumnWidth}
          isChildrenExpanded={!isCollapsed}
          isDetailExpanded={isDetailExpanded}
          isMatchingFilter={isMatchingFilter}
          isFocused={isFocused}
          numTicks={NUM_TICKS}
          onDetailToggled={(args) => {
            setSelectedSpan(span);
          }}
          onChildrenToggled={childrenToggle}
          rpc={rpc}
          noInstrumentedServer={noInstrumentedServer}
          showErrorIcon={showErrorIcon}
          getViewedBounds={this.getViewedBounds()}
          traceStartTime={trace.startTime}
          span={span}
          hoverIndentGuideIds={hoverIndentGuideIds}
          addHoverIndentGuideId={addHoverIndentGuideId}
          removeHoverIndentGuideId={removeHoverIndentGuideId}
          createSpanLink={createSpanLink}
          datasourceType={datasourceType}
          prevSpan={prevSpan}
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
      detailReferenceItemToggle,
      detailWarningsToggle,
      detailStackTracesToggle,
      detailStates,
      detailTagsToggle,
      detailToggle,
      spanNameColumnWidth,
      trace,
      timeZone,
      hoverIndentGuideIds,
      addHoverIndentGuideId,
      removeHoverIndentGuideId,
      linksGetter,
      createSpanLink,
      focusedSpanId,
      createFocusSpanLink,
      topOfViewRefType,
      theme,
      datasourceType,
    } = this.props;
    const detailState = detailStates.get(spanID);
    if (!trace || !detailState) {
      return null;
    }
    const color = getColorByKey(serviceName, theme);
    const styles = getStyles(this.props);
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
          referenceItemToggle={detailReferenceItemToggle}
          referencesToggle={detailReferencesToggle}
          warningsToggle={detailWarningsToggle}
          stackTracesToggle={detailStackTracesToggle}
          span={span}
          timeZone={timeZone}
          tagsToggle={detailTagsToggle}
          traceStartTime={trace.startTime}
          hoverIndentGuideIds={hoverIndentGuideIds}
          addHoverIndentGuideId={addHoverIndentGuideId}
          removeHoverIndentGuideId={removeHoverIndentGuideId}
          createSpanLink={createSpanLink}
          focusedSpanId={focusedSpanId}
          createFocusSpanLink={createFocusSpanLink}
          topOfViewRefType={topOfViewRefType}
          datasourceType={datasourceType}
        />
      </div>
    );
  }

  scrollToTop = () => {
    const { topOfViewRef, datasourceType, trace } = this.props;
    topOfViewRef?.current?.scrollIntoView({ behavior: 'smooth' });
    reportInteraction('grafana_traces_trace_view_scroll_to_top_clicked', {
      datasourceType: datasourceType,
      grafana_version: config.buildInfo.version,
      numServices: trace.services.length,
      numSpans: trace.spans.length,
    });
  };

  render() {
    const styles = getStyles(this.props);
    const { scrollElement } = this.props;
    return (
      <>
        <ListView
          ref={this.setListView}
          dataLength={this.getRowStates().length}
          itemHeightGetter={this.getRowHeight}
          itemRenderer={this.renderRow}
          viewBuffer={50}
          viewBufferMin={50}
          itemsWrapperClassName={styles.rowsWrapper}
          getKeyFromIndex={this.getKeyFromIndex}
          getIndexFromKey={this.getIndexFromKey}
          windowScroller={false}
          scrollElement={scrollElement}
        />
        <ToolbarButton
          className={styles.scrollToTopButton}
          onClick={this.scrollToTop}
          title="Scroll to top"
          icon="arrow-up"
        ></ToolbarButton>
      </>
    );
  }
}

export default withTheme2(UnthemedVirtualizedTraceView);
