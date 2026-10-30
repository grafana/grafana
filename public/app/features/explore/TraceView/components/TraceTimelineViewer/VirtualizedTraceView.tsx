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

import { css, cx } from '@emotion/css';
import memoizeOne from 'memoize-one';
import * as React from 'react';
import { memo, type RefObject, useLayoutEffect, useMemo, useRef } from 'react';

import { type CoreApp, type LinkModel, type TimeRange, type TraceLog } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type TraceToProfilesOptions } from '@grafana/o11y-ds-frontend';
import { config, reportInteraction } from '@grafana/runtime';
import { type TimeZone } from '@grafana/schema';
import { ToolbarButton, useStyles2, useTheme2 } from '@grafana/ui';

import { PEER_SERVICE } from '../constants/tag-keys';
import { type SpanBarOptions } from '../settings/SpanBarSettings';
import type TNil from '../types/TNil';
import type TTraceTimeline from '../types/TTraceTimeline';
import { type SpanLinkFunc } from '../types/links';
import { type TraceSpan, type Trace, type TraceSpanReference, type CriticalPathSection } from '../types/trace';
import { getColorByKey } from '../utils/color-generator';
import { getServiceColorKey, getServiceDisplayName } from '../utils/service-name';
import { countSummarySpans } from '../utils/summary-span';

import ListView from './ListView';
import { SpanBarRow } from './SpanBarRow';
import { type TraceFlameGraphs } from './SpanDetail';
import type DetailState from './SpanDetail/DetailState';
import SpanDetailRow from './SpanDetailRow';
import { createViewedBoundsFunc, findServerChildSpan, isErrorSpan, isKindClient, spanContainsErredSpan } from './utils';

const getStyles = () => ({
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
});

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
  childrenToggle: (spanID: string) => void;
  detailLogItemToggle: (spanID: string, log: TraceLog) => void;
  detailLogsToggle: (spanID: string) => void;
  detailWarningsToggle: (spanID: string) => void;
  detailStackTracesToggle: (spanID: string) => void;
  detailReferencesToggle: (spanID: string) => void;
  detailReferenceItemToggle: (spanID: string, reference: TraceSpanReference) => void;
  detailProcessToggle: (spanID: string) => void;
  detailTagsToggle: (spanID: string) => void;
  detailSummaryAttributesToggle: (spanID: string) => void;
  detailToggle: (spanID: string) => void;
  setSpanNameColumnWidth: (width: number) => void;
  hoverIndentGuideIds: Set<string>;
  addHoverIndentGuideId: (spanID: string) => void;
  removeHoverIndentGuideId: (spanID: string) => void;
  createSpanLink?: SpanLinkFunc;
  scrollElement?: Element;
  focusedSpanId?: string;
  focusedSpanForSearch?: { spanID: string };
  showSpanFilterMatchesOnly: boolean;
  createFocusSpanLink: (traceId: string, spanId: string) => LinkModel;
  topOfViewRef?: RefObject<HTMLDivElement | null>;
  datasourceType: string;
  datasourceUid: string;
  headerHeight: number;
  criticalPath: CriticalPathSection[];
  traceFlameGraphs: TraceFlameGraphs;
  setTraceFlameGraphs: (flameGraphs: TraceFlameGraphs) => void;
  redrawListView: {};
  setRedrawListView: (redraw: {}) => void;
  timeRange: TimeRange;
  app: CoreApp | string;
};

export type VirtualizedTraceViewProps = TVirtualizedTraceViewOwnProps & TTraceTimeline;

// export for tests
const DEFAULT_HEIGHTS = {
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
  criticalPath: CriticalPathSection[]
): RowState[] {
  if (!spans) {
    return [];
  }
  // Apply filtering when matchesOnly is enabled
  // Critical path filtering is now integrated into findMatchesIDs
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

function generateRowStatesFromTrace(
  trace: Trace | TNil,
  childrenHiddenIDs: Set<string>,
  detailStates: Map<string, DetailState | TNil>,
  findMatchesIDs: Set<string> | TNil,
  showSpanFilterMatchesOnly: boolean,
  criticalPath: CriticalPathSection[]
): RowState[] {
  return trace
    ? generateRowStates(
        trace.spans,
        childrenHiddenIDs,
        detailStates,
        findMatchesIDs,
        showSpanFilterMatchesOnly,
        criticalPath
      )
    : [];
}

function getChildSpansMap(trace: Trace | TNil) {
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

function scrollToSpan(
  listView: ListView | null,
  { rowStates, headerHeight }: { rowStates: RowState[]; headerHeight: number },
  spanID?: string
) {
  if (spanID == null) {
    return;
  }
  const i = rowStates.findIndex((row) => row.span.spanID === spanID);
  if (i >= 0) {
    listView?.scrollToIndex(i, headerHeight);
  }
}

const VirtualizedTraceView = memo(function VirtualizedTraceView(props: VirtualizedTraceViewProps) {
  const {
    childrenHiddenIDs,
    detailStates,
    trace,
    findMatchesIDs,
    showSpanFilterMatchesOnly,
    criticalPath,
    currentViewRangeTime,
    headerHeight,
    focusedSpanId,
    focusedSpanForSearch,
    scrollElement,
    redrawListView,
    topOfViewRef,
  } = props;
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const listViewRef = useRef<ListView>(null);

  const rowStates = useMemo(
    () =>
      generateRowStatesFromTrace(
        trace,
        childrenHiddenIDs,
        detailStates,
        findMatchesIDs,
        showSpanFilterMatchesOnly,
        criticalPath
      ),
    [trace, childrenHiddenIDs, detailStates, findMatchesIDs, showSpanFilterMatchesOnly, criticalPath]
  );

  const [zoomStart, zoomEnd] = currentViewRangeTime;
  const traceStartTime = trace?.startTime ?? 0;
  const traceEndTime = trace?.endTime ?? 0;
  const getViewedBounds = useMemo(
    () => createViewedBoundsFunc({ min: traceStartTime, max: traceEndTime, viewStart: zoomStart, viewEnd: zoomEnd }),
    [traceStartTime, traceEndTime, zoomStart, zoomEnd]
  );

  const childSpansMap = useMemo(() => getChildSpansMap(trace), [trace]);

  // Memoized so the memo'd rows get a stable array while the visible window doesn't change.
  const getVisibleSpanIds = useMemo(
    () =>
      memoizeOne((start: number, end: number) => {
        const spanIds = [];
        for (let i = start; i < end; i++) {
          const rowState = rowStates[i];
          if (rowState?.span) {
            spanIds.push(rowState.span.spanID);
          }
        }
        return spanIds;
      }),
    [rowStates]
  );

  // Lets the scroll effects read the latest rows and header height without re-scrolling when those change.
  const scrollStateRef = useRef({ rowStates, headerHeight });
  useLayoutEffect(() => {
    scrollStateRef.current = { rowStates, headerHeight };
  });

  // The scroll element and header height may not be settled on mount, so retry the initial scroll on the first update.
  const hasRetriedScrollRef = useRef(false);
  useLayoutEffect(() => {
    if (isMountedRef.current && !hasRetriedScrollRef.current) {
      hasRetriedScrollRef.current = true;
      scrollToSpan(listViewRef.current, scrollStateRef.current, focusedSpanId);
    }
  });

  useLayoutEffect(() => {
    scrollToSpan(listViewRef.current, scrollStateRef.current, focusedSpanId);
  }, [focusedSpanId]);

  useLayoutEffect(() => {
    if (isMountedRef.current) {
      scrollToSpan(listViewRef.current, scrollStateRef.current, focusedSpanForSearch?.spanID);
    }
  }, [focusedSpanForSearch]);

  const isMountedRef = useRef(false);
  useLayoutEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const getKeyFromIndex = (index: number) => {
    const { isDetail, span } = rowStates[index];
    return `${span.traceID}--${span.spanID}--${isDetail ? 'detail' : 'bar'}`;
  };

  const getIndexFromKey = (key: string) => {
    const parts = key.split('--');
    const _traceID = parts[0];
    const _spanID = parts[1];
    const _isDetail = parts[2] === 'detail';
    return rowStates.findIndex(
      ({ span, isDetail }) => span.spanID === _spanID && span.traceID === _traceID && isDetail === _isDetail
    );
  };

  const getRowHeight = (index: number) => {
    const { span, isDetail } = rowStates[index];
    if (!isDetail) {
      return DEFAULT_HEIGHTS.bar;
    }
    if (Array.isArray(span.logs) && span.logs.length) {
      return DEFAULT_HEIGHTS.detailWithLogs;
    }
    return DEFAULT_HEIGHTS.detail;
  };

  const renderSpanBarRow = (
    span: TraceSpan,
    spanIndex: number,
    key: string,
    style: React.CSSProperties,
    attrs: {},
    visibleSpanIds: string[]
  ) => {
    const { spanID, childSpanIds } = span;
    const serviceColorKey = getServiceColorKey(span.process);
    const {
      childrenToggle,
      detailToggle,
      spanNameColumnWidth,
      spanBarOptions,
      hoverIndentGuideIds,
      addHoverIndentGuideId,
      removeHoverIndentGuideId,
      createSpanLink,
      datasourceType,
    } = props;
    // to avert flow error
    if (!trace) {
      return null;
    }
    const color = getColorByKey(serviceColorKey, theme);
    const isCollapsed = childrenHiddenIDs.has(spanID);
    const isDetailExpanded = detailStates.has(spanID);
    const isMatchingFilter = findMatchesIDs ? findMatchesIDs.has(spanID) : false;
    const isFocused = spanID === focusedSpanId || spanID === focusedSpanForSearch?.spanID;
    const showErrorIcon = isErrorSpan(span) || (isCollapsed && spanContainsErredSpan(trace.spans, spanIndex));

    // Check for direct child "server" span if the span is a "client" span.
    let rpc = null;
    if (isCollapsed) {
      const rpcSpan = findServerChildSpan(trace.spans.slice(spanIndex));
      if (rpcSpan) {
        const rpcViewBounds = getViewedBounds(rpcSpan.startTime, rpcSpan.startTime + rpcSpan.duration);
        rpc = {
          color: getColorByKey(getServiceColorKey(rpcSpan.process), theme),
          operationName: rpcSpan.operationName,
          serviceName: getServiceDisplayName(rpcSpan.process),
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
        const childrenOfCurrent = childSpansMap.get(eachId);
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

    return (
      <div className={styles.row} key={key} style={style} {...attrs}>
        <SpanBarRow
          clippingLeft={zoomStart > 0}
          clippingRight={zoomEnd < 1}
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
          getViewedBounds={getViewedBounds}
          traceStartTime={trace.startTime}
          span={span}
          hoverIndentGuideIds={hoverIndentGuideIds}
          addHoverIndentGuideId={addHoverIndentGuideId}
          removeHoverIndentGuideId={removeHoverIndentGuideId}
          createSpanLink={createSpanLink}
          datasourceType={datasourceType}
          showServiceName={
            prevSpan === null || getServiceColorKey(prevSpan.process) !== getServiceColorKey(span.process)
          }
          visibleSpanIds={visibleSpanIds}
          criticalPath={criticalPathSections}
        />
      </div>
    );
  };

  const renderSpanDetailRow = (
    span: TraceSpan,
    key: string,
    style: React.CSSProperties,
    attrs: {},
    visibleSpanIds: string[]
  ) => {
    const { spanID } = span;
    const serviceColorKey = getServiceColorKey(span.process);
    const {
      detailLogItemToggle,
      detailLogsToggle,
      detailProcessToggle,
      detailReferencesToggle,
      detailReferenceItemToggle,
      detailWarningsToggle,
      detailStackTracesToggle,
      detailTagsToggle,
      detailSummaryAttributesToggle,
      detailToggle,
      spanNameColumnWidth,
      traceToProfilesOptions,
      timeZone,
      hoverIndentGuideIds,
      addHoverIndentGuideId,
      removeHoverIndentGuideId,
      createSpanLink,
      createFocusSpanLink,
      datasourceType,
      datasourceUid,
      traceFlameGraphs,
      setTraceFlameGraphs,
      setRedrawListView,
      timeRange,
      app,
    } = props;
    const detailState = detailStates.get(spanID);
    if (!trace || !detailState) {
      return null;
    }
    const color = getColorByKey(serviceColorKey, theme);

    return (
      <div className={cx(styles.row, 'span-detail-row')} key={key} style={{ ...style, zIndex: 1 }} {...attrs}>
        <SpanDetailRow
          color={color}
          columnDivision={spanNameColumnWidth}
          onDetailToggled={detailToggle}
          detailState={detailState}
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
          summaryAttributesToggle={detailSummaryAttributesToggle}
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
          datasourceUid={datasourceUid}
          visibleSpanIds={visibleSpanIds}
          traceFlameGraphs={traceFlameGraphs}
          setTraceFlameGraphs={setTraceFlameGraphs}
          setRedrawListView={setRedrawListView}
          timeRange={timeRange}
          app={app}
        />
      </div>
    );
  };

  const renderRow = (key: string, style: React.CSSProperties, index: number, attrs: {}) => {
    const { isDetail, span, spanIndex } = rowStates[index];

    // Compute the list of currently visible span IDs to pass to the row renderers.
    const listView = listViewRef.current;
    const start = Math.max((listView?.getTopVisibleIndex() || 0) - BUFFER_SIZE, 0);
    const end = (listView?.getBottomVisibleIndex() || 0) + BUFFER_SIZE;
    const visibleSpanIds = getVisibleSpanIds(start, end);

    return isDetail
      ? renderSpanDetailRow(span, key, style, attrs, visibleSpanIds)
      : renderSpanBarRow(span, spanIndex, key, style, attrs, visibleSpanIds);
  };

  const scrollToTop = () => {
    const { datasourceType } = props;
    topOfViewRef?.current?.scrollIntoView({ behavior: 'smooth' });
    // trace can be unset (button still renders); skip analytics rather than dereference it.
    if (!trace) {
      return;
    }
    reportInteraction('grafana_traces_trace_view_scroll_to_top_clicked', {
      datasourceType: datasourceType,
      grafana_version: config.buildInfo.version,
      numServices: trace.services.length,
      numSpans: trace.spans.length,
      numSummarySpans: countSummarySpans(trace.spans),
    });
  };

  return (
    <>
      <ListView
        ref={listViewRef}
        dataLength={rowStates.length}
        itemHeightGetter={getRowHeight}
        itemRenderer={renderRow}
        viewBuffer={BUFFER_SIZE}
        viewBufferMin={BUFFER_SIZE}
        itemsWrapperClassName={styles.rowsWrapper}
        getKeyFromIndex={getKeyFromIndex}
        getIndexFromKey={getIndexFromKey}
        windowScroller={false}
        scrollElement={scrollElement}
        redraw={redrawListView}
      />
      {topOfViewRef && ( // only for panel as explore uses content outline to scroll to top
        <ToolbarButton
          className={styles.scrollToTopButton}
          onClick={scrollToTop}
          tooltip={t('explore.unthemed-virtualized-trace-view.title-scroll-to-top', 'Scroll to top')}
          icon="arrow-up"
        ></ToolbarButton>
      )}
    </>
  );
});

export default VirtualizedTraceView;
