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

import { GrafanaTheme2, LinkModel } from '@grafana/data';
import { TraceToProfilesOptions } from '@grafana/o11y-ds-frontend';
import { config, reportInteraction } from '@grafana/runtime';
import { TimeZone } from '@grafana/schema';
import { stylesFactory, withTheme2, ToolbarButton } from '@grafana/ui';

import { PEER_SERVICE } from '../constants/tag-keys';
import { CriticalPathSection, SpanBarOptions, SpanLinkFunc, TNil } from '../types';
import TTraceTimeline from '../types/TTraceTimeline';
import { TraceLog, TraceSpan, Trace, TraceKeyValuePair, TraceLink, TraceSpanReference } from '../types/trace';
import { getColorByKey } from '../utils/color-generator';

import ListView from './ListView';
import SpanBarRow from './SpanBarRow';
import { TraceFlameGraphs } from './SpanDetail';
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

const getStyles = stylesFactory(() => ({
  rowsWrapper: css({
    width: '100%',
  }),
  row: css({
    width: '100%',
  }),
  scrollToTopButton: css({
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    width: '40px',
    height: '40px',
    position: 'absolute',
    bottom: '30px',
    right: '30px',
    zIndex: 1,
  }),
}));

type RowState = {
  isDetail: boolean;
  span: TraceSpan;
  spanIndex: number;
};

type TVirtualizedTraceViewOwnProps = {
  currentViewRangeTime: [number, number];
  timeZone: TimeZone;
  findMatchesIDs: Set<string> | TNil;
  trace: Trace;
  traceToProfilesOptions?: TraceToProfilesOptions;
  spanBarOptions: SpanBarOptions | undefined;
  linksGetter: (span: TraceSpan, items: TraceKeyValuePair[], itemIndex: number) => TraceLink[];
  childrenToggle: (spanID: string) => void;
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
  hoverIndentGuideIds: Set<string>;
  addHoverIndentGuideId: (spanID: string) => void;
  removeHoverIndentGuideId: (spanID: string) => void;
  theme: GrafanaTheme2;
  createSpanLink?: SpanLinkFunc;
  scrollElement?: Element;
  focusedSpanId?: string;
  focusedSpanIdForSearch: string;
  showSpanFilterMatchesOnly: boolean;
  showCriticalPathSpansOnly: boolean;
  createFocusSpanLink: (traceId: string, spanId: string) => LinkModel;
  topOfViewRef?: RefObject<HTMLDivElement>;
  datasourceType: string;
  headerHeight: number;
  criticalPath: CriticalPathSection[];
  traceFlameGraphs: TraceFlameGraphs;
  setTraceFlameGraphs: (flameGraphs: TraceFlameGraphs) => void;
  redrawListView: {};
  setRedrawListView: (redraw: {}) => void;
};

export type VirtualizedTraceViewProps = TVirtualizedTraceViewOwnProps & TTraceTimeline;

// export for tests
export const DEFAULT_HEIGHTS = {
  bar: 28,
  detail: 161,
  detailWithLogs: 197,
};

const NUM_TICKS = 5;
const BUFFER_SIZE = 33;

function generateRowStates(
  spans: TraceSpan[] | TNil,
  childrenHiddenIDs: Set<string>,
  detailStates: Map<string, DetailState | TNil>,
  findMatchesIDs: Set<string> | TNil,
  showSpanFilterMatchesOnly: boolean,
  showCriticalPathSpansOnly: boolean,
  criticalPath: CriticalPathSection[]
): RowState[] {
  if (!spans) {
    return [];
  }
  if (showSpanFilterMatchesOnly && findMatchesIDs) {
    spans = spans.filter((span) => findMatchesIDs.has(span.spanID));
  }

  if (showCriticalPathSpansOnly && criticalPath) {
    spans = spans.filter((span) => criticalPath.find((section) => section.spanId === span.spanID));
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
  detailStates: Map<string, DetailState | TNil>,
  findMatchesIDs: Set<string> | TNil,
  showSpanFilterMatchesOnly: boolean,
  showCriticalPathSpansOnly: boolean,
  criticalPath: CriticalPathSection[]
): RowState[] {
  return trace
    ? generateRowStates(
        trace.spans,
        childrenHiddenIDs,
        detailStates,
        findMatchesIDs,
        showSpanFilterMatchesOnly,
        showCriticalPathSpansOnly,
        criticalPath
      )
    : [];
}

function childSpansMap(trace: Trace | TNil) {
  const childSpansMap = new Map<string, string[]>();
  if (!trace) {
    return childSpansMap;
  }
  trace.spans.forEach((span) => {
    if (span.childSpanIds.length) {
      childSpansMap.set(span.spanID, span.childSpanIds);
    }
  });
  return childSpansMap;
}

const memoizedGenerateRowStates = memoizeOne(generateRowStatesFromTrace);
const memoizedViewBoundsFunc = memoizeOne(createViewedBoundsFunc, isEqual);
const memoizedGetClipping = memoizeOne(getClipping, isEqual);
const memoizedChildSpansMap = memoizeOne(childSpansMap);

// export from tests
export class UnthemedVirtualizedTraceView extends React.Component<VirtualizedTraceViewProps> {
  listView: ListView | TNil;
  hasScrolledToSpan = false;

  componentDidMount() {
    this.scrollToSpan(this.props.headerHeight, this.props.focusedSpanId);
  }

  shouldComponentUpdate(nextProps: VirtualizedTraceViewProps) {
    // If any prop updates, VirtualizedTraceViewImpl should update.
    let key: keyof VirtualizedTraceViewProps;
    for (key in nextProps) {
      if (nextProps[key] !== this.props[key]) {
        return true;
      }
    }
    return false;
  }

  componentDidUpdate(prevProps: Readonly<VirtualizedTraceViewProps>) {
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

  getRowStates(): RowState[] {
    const {
      childrenHiddenIDs,
      detailStates,
      trace,
      findMatchesIDs,
      showSpanFilterMatchesOnly,
      showCriticalPathSpansOnly,
      criticalPath,
    } = this.props;
    return memoizedGenerateRowStates(
      trace,
      childrenHiddenIDs,
      detailStates,
      findMatchesIDs,
      showSpanFilterMatchesOnly,
      showCriticalPathSpansOnly,
      criticalPath
    );
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

  getChildSpansMap() {
    return memoizedChildSpansMap(this.props.trace);
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
    this.listView = listView;
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

    // Compute the list of currently visible span IDs to pass to the row renderers.
    const start = Math.max((this.listView?.getTopVisibleIndex() || 0) - BUFFER_SIZE, 0);
    const end = (this.listView?.getBottomVisibleIndex() || 0) + BUFFER_SIZE;
    const visibleSpanIds = this.getVisibleSpanIds(start, end);

    return isDetail
      ? this.renderSpanDetailRow(span, key, style, attrs, visibleSpanIds)
      : this.renderSpanBarRow(span, spanIndex, key, style, attrs, visibleSpanIds);
  };

  scrollToSpan = (headerHeight: number, spanID?: string) => {
    if (spanID == null) {
      return;
    }
    const i = this.getRowStates().findIndex((row) => row.span.spanID === spanID);
    if (i >= 0) {
      this.listView?.scrollToIndex(i, headerHeight);
    }
  };

  renderSpanBarRow(
    span: TraceSpan,
    spanIndex: number,
    key: string,
    style: React.CSSProperties,
    attrs: {},
    visibleSpanIds: string[]
  ) {
    const { spanID, childSpanIds } = span;
    const { serviceName } = span.process;
    const {
      childrenHiddenIDs,
      childrenToggle,
      detailStates,
      detailToggle,
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
      showSpanFilterMatchesOnly,
      theme,
      datasourceType,
      criticalPath,
    } = this.props;
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

    const allChildSpanIds = [spanID, ...childSpanIds];
    // This function called recursively to find all descendants of a span
    const findAllDescendants = (currentChildSpanIds: string[]) => {
      currentChildSpanIds.forEach((eachId) => {
        const childrenOfCurrent = this.getChildSpansMap().get(eachId);
        if (childrenOfCurrent?.length) {
          allChildSpanIds.push(...childrenOfCurrent);
          findAllDescendants(childrenOfCurrent);
        }
      });
    };
    findAllDescendants(childSpanIds);
    const criticalPathSections = criticalPath?.filter((each) => {
      if (isCollapsed) {
        return allChildSpanIds.includes(each.spanId);
      }
      return each.spanId === spanID;
    });

    const styles = getStyles();
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
          showSpanFilterMatchesOnly={showSpanFilterMatchesOnly}
          numTicks={NUM_TICKS}
          onDetailToggled={detailToggle}
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
          showServiceName={prevSpan === null || prevSpan.process.serviceName !== span.process.serviceName}
          visibleSpanIds={visibleSpanIds}
          criticalPath={criticalPathSections}
        />
      </div>
    );
  }

  renderSpanDetailRow(span: TraceSpan, key: string, style: React.CSSProperties, attrs: {}, visibleSpanIds: string[]) {
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
      traceToProfilesOptions,
      timeZone,
      hoverIndentGuideIds,
      addHoverIndentGuideId,
      removeHoverIndentGuideId,
      linksGetter,
      createSpanLink,
      focusedSpanId,
      createFocusSpanLink,
      theme,
      datasourceType,
      traceFlameGraphs,
      setTraceFlameGraphs,
      setRedrawListView,
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
          referenceItemToggle={detailReferenceItemToggle}
          referencesToggle={detailReferencesToggle}
          warningsToggle={detailWarningsToggle}
          stackTracesToggle={detailStackTracesToggle}
          span={span}
          traceToProfilesOptions={traceToProfilesOptions}
          timeZone={timeZone}
          tagsToggle={detailTagsToggle}
          traceStartTime={trace.startTime}
          traceDuration={trace.duration}
          traceName={trace.traceName}
          hoverIndentGuideIds={hoverIndentGuideIds}
          addHoverIndentGuideId={addHoverIndentGuideId}
          removeHoverIndentGuideId={removeHoverIndentGuideId}
          createSpanLink={createSpanLink}
          focusedSpanId={focusedSpanId}
          createFocusSpanLink={createFocusSpanLink}
          datasourceType={datasourceType}
          visibleSpanIds={visibleSpanIds}
          traceFlameGraphs={traceFlameGraphs}
          setTraceFlameGraphs={setTraceFlameGraphs}
          setRedrawListView={setRedrawListView}
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

  getVisibleSpanIds = memoizeOne((start: number, end: number) => {
    const spanIds = [];
    for (let i = start; i < end; i++) {
      const rowState = this.getRowStates()[i];
      if (rowState?.span) {
        spanIds.push(rowState.span.spanID);
      }
    }
    return spanIds;
  });

  render() {
    const styles = getStyles();
    const { scrollElement, redrawListView } = this.props;

    return (
      <>
        <ListView
          ref={this.setListView}
          dataLength={this.getRowStates().length}
          itemHeightGetter={this.getRowHeight}
          itemRenderer={this.renderRow}
          viewBuffer={BUFFER_SIZE}
          viewBufferMin={BUFFER_SIZE}
          itemsWrapperClassName={styles.rowsWrapper}
          getKeyFromIndex={this.getKeyFromIndex}
          getIndexFromKey={this.getIndexFromKey}
          windowScroller={false}
          scrollElement={scrollElement}
          redraw={redrawListView}
        />
        {this.props.topOfViewRef && ( // only for panel as explore uses content outline to scroll to top
          <ToolbarButton
            className={styles.scrollToTopButton}
            onClick={this.scrollToTop}
            title="Scroll to top"
            icon="arrow-up"
          ></ToolbarButton>
        )}
      </>
    );
  }
}

export default withTheme2(UnthemedVirtualizedTraceView);
