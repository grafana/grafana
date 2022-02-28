import {
  DataFrame,
  DataFrameView,
  DataLink,
  DataSourceApi,
  Field,
  LinkModel,
  mapInternalLinkToExplore,
  SplitOpen,
  TraceSpanRow,
} from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import {
  Trace,
  TracePageHeader,
  TraceProcess,
  TraceResponse,
  TraceTimelineViewer,
  transformTraceData,
  TTraceTimeline,
} from '@jaegertracing/jaeger-ui-components';
import { TraceToLogsData } from 'app/core/components/TraceToLogs/TraceToLogsSettings';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { getTimeZone } from 'app/features/profile/state/selectors';
import { StoreState } from 'app/types';
import { ExploreId } from 'app/types/explore';
import React, { useCallback, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { changePanelState } from '../state/explorePane';
import { createSpanLinkFactory } from './createSpanLink';
import { useChildrenState } from './useChildrenState';
import { useDetailState } from './useDetailState';
import { useHoverIndentGuide } from './useHoverIndentGuide';
import { useSearch } from './useSearch';
import { useViewRange } from './useViewRange';

function noop(): {} {
  return {};
}

type Props = {
  dataFrames: DataFrame[];
  splitOpenFn: SplitOpen;
  exploreId: ExploreId;
  scrollElement?: Element;
};

export function TraceView(props: Props) {
  // At this point we only show single trace
  const frame = props.dataFrames[0];

  const { expandOne, collapseOne, childrenToggle, collapseAll, childrenHiddenIDs, expandAll } = useChildrenState();
  const {
    detailStates,
    toggleDetail,
    detailLogItemToggle,
    detailLogsToggle,
    detailProcessToggle,
    detailReferencesToggle,
    detailReferenceItemToggle,
    detailTagsToggle,
    detailWarningsToggle,
    detailStackTracesToggle,
  } = useDetailState(frame);

  const { removeHoverIndentGuideId, addHoverIndentGuideId, hoverIndentGuideIds } = useHoverIndentGuide();
  const { viewRange, updateViewRangeTime, updateNextViewRangeTime } = useViewRange();

  /**
   * Keeps state of resizable name column width
   */
  const [spanNameColumnWidth, setSpanNameColumnWidth] = useState(0.25);
  /**
   * State of the top minimap, slim means it is collapsed.
   */
  const [slim, setSlim] = useState(false);

  const traceProp = useMemo(() => transformDataFrames(frame), [frame]);
  const { search, setSearch, spanFindMatches, clearSearch } = useSearch(traceProp?.spans);

  const datasource = useSelector(
    (state: StoreState) => state.explore[props.exploreId]?.datasourceInstance ?? undefined
  );

  const [focusedSpanId, createFocusSpanLink] = useFocusSpanLink({
    refId: frame?.refId,
    exploreId: props.exploreId,
    datasource,
  });

  const createLinkToExternalSpan = (traceId: string, spanId: string) => {
    const link = createFocusSpanLink(traceId, spanId);
    return link.href;
  };

  const traceTimeline: TTraceTimeline = useMemo(
    () => ({
      childrenHiddenIDs,
      detailStates,
      hoverIndentGuideIds,
      shouldScrollToFirstUiFindMatch: false,
      spanNameColumnWidth,
      traceID: traceProp?.traceID,
    }),
    [childrenHiddenIDs, detailStates, hoverIndentGuideIds, spanNameColumnWidth, traceProp?.traceID]
  );

  const traceToLogsOptions = (getDatasourceSrv().getInstanceSettings(datasource?.name)?.jsonData as TraceToLogsData)
    ?.tracesToLogs;
  const createSpanLink = useMemo(
    () => createSpanLinkFactory({ splitOpenFn: props.splitOpenFn, traceToLogsOptions, dataFrame: frame }),
    [props.splitOpenFn, traceToLogsOptions, frame]
  );
  const onSlimViewClicked = useCallback(() => setSlim(!slim), [slim]);
  const timeZone = useSelector((state: StoreState) => getTimeZone(state.user));

  if (!props.dataFrames?.length || !traceProp) {
    return null;
  }

  return (
    <>
      <TracePageHeader
        canCollapse={false}
        clearSearch={clearSearch}
        focusUiFindMatches={noop}
        hideMap={false}
        hideSummary={false}
        nextResult={noop}
        onSlimViewClicked={onSlimViewClicked}
        onTraceGraphViewClicked={noop}
        prevResult={noop}
        resultCount={spanFindMatches?.size ?? 0}
        slimView={slim}
        trace={traceProp}
        updateNextViewRangeTime={updateNextViewRangeTime}
        updateViewRangeTime={updateViewRangeTime}
        viewRange={viewRange}
        searchValue={search}
        onSearchValueChange={setSearch}
        timeZone={timeZone}
      />
      <TraceTimelineViewer
        registerAccessors={noop}
        scrollToFirstVisibleSpan={noop}
        findMatchesIDs={spanFindMatches}
        trace={traceProp}
        traceTimeline={traceTimeline}
        updateNextViewRangeTime={updateNextViewRangeTime}
        updateViewRangeTime={updateViewRangeTime}
        viewRange={viewRange}
        focusSpan={noop}
        createLinkToExternalSpan={createLinkToExternalSpan}
        setSpanNameColumnWidth={setSpanNameColumnWidth}
        collapseAll={collapseAll}
        collapseOne={collapseOne}
        expandAll={expandAll}
        expandOne={expandOne}
        childrenToggle={childrenToggle}
        clearShouldScrollToFirstUiFindMatch={noop}
        detailLogItemToggle={detailLogItemToggle}
        detailLogsToggle={detailLogsToggle}
        detailWarningsToggle={detailWarningsToggle}
        detailStackTracesToggle={detailStackTracesToggle}
        detailReferencesToggle={detailReferencesToggle}
        detailReferenceItemToggle={detailReferenceItemToggle}
        detailProcessToggle={detailProcessToggle}
        detailTagsToggle={detailTagsToggle}
        detailToggle={toggleDetail}
        setTrace={noop}
        addHoverIndentGuideId={addHoverIndentGuideId}
        removeHoverIndentGuideId={removeHoverIndentGuideId}
        linksGetter={noop as any}
        uiFind={search}
        createSpanLink={createSpanLink}
        scrollElement={props.scrollElement}
        focusedSpanId={focusedSpanId}
        createFocusSpanLink={createFocusSpanLink}
      />
    </>
  );
}

function transformDataFrames(frame?: DataFrame): Trace | null {
  if (!frame) {
    return null;
  }
  let data: TraceResponse =
    frame.fields.length === 1
      ? // For backward compatibility when we sent whole json response in a single field/value
        frame.fields[0].values.get(0)
      : transformTraceDataFrame(frame);
  return transformTraceData(data);
}

function transformTraceDataFrame(frame: DataFrame): TraceResponse {
  const view = new DataFrameView<TraceSpanRow>(frame);
  const processes: Record<string, TraceProcess> = {};
  for (let i = 0; i < view.length; i++) {
    const span = view.get(i);
    if (!processes[span.spanID]) {
      processes[span.spanID] = {
        serviceName: span.serviceName,
        tags: span.serviceTags,
      };
    }
  }

  return {
    traceID: view.get(0).traceID,
    processes,
    spans: view.toArray().map((s, index) => {
      const references = [];
      if (s.parentSpanID) {
        references.push({ refType: 'CHILD_OF' as const, spanID: s.parentSpanID, traceID: s.traceID });
      }
      if (s.references) {
        references.push(...s.references.map((reference) => ({ refType: 'FOLLOWS_FROM' as const, ...reference })));
      }
      return {
        ...s,
        duration: s.duration * 1000,
        startTime: s.startTime * 1000,
        processID: s.spanID,
        flags: 0,
        references,
        logs: s.logs?.map((l) => ({ ...l, timestamp: l.timestamp * 1000 })) || [],
        dataFrameRowIndex: index,
      };
    }),
  };
}

/**
 * Handles focusing a span. Returns the span id to focus to based on what is in current explore state and also a
 * function to change the focused span id.
 * @param options
 */
function useFocusSpanLink(options: {
  exploreId: ExploreId;
  refId?: string;
  datasource?: DataSourceApi;
}): [string | undefined, (traceId: string, spanId: string) => LinkModel<Field>] {
  const panelState = useSelector((state: StoreState) => state.explore[options.exploreId]?.panelsState.trace);
  const focusedSpanId = panelState?.spanId;

  const dispatch = useDispatch();
  const setFocusedSpanId = (spanId?: string) =>
    dispatch(
      changePanelState(options.exploreId, 'trace', {
        ...panelState,
        spanId,
      })
    );

  const query = useSelector((state: StoreState) =>
    state.explore[options.exploreId]?.queries.find((query) => query.refId === options.refId)
  );

  const createFocusSpanLink = (traceId: string, spanId: string) => {
    const link: DataLink = {
      title: 'Deep link to this span',
      url: '',
      internal: {
        datasourceUid: options.datasource?.uid!,
        datasourceName: options.datasource?.name!,
        query: query,
        panelsState: {
          trace: {
            spanId,
          },
        },
      },
    };

    return mapInternalLinkToExplore({
      link,
      internalLink: link.internal!,
      scopedVars: {},
      range: {} as any,
      field: {} as Field,
      onClickFn: () => setFocusedSpanId(focusedSpanId === spanId ? undefined : spanId),
      replaceVariables: getTemplateSrv().replace.bind(getTemplateSrv()),
    });
  };

  return [focusedSpanId, createFocusSpanLink];
}
