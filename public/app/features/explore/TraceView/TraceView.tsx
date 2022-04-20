import {
  DataFrame,
  DataLink,
  DataSourceApi,
  Field,
  LinkModel,
  LoadingState,
  mapInternalLinkToExplore,
  PanelData,
  SplitOpen,
} from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import {
  Trace,
  TracePageHeader,
  TraceSpan,
  TraceTimelineViewer,
  TTraceTimeline,
} from '@jaegertracing/jaeger-ui-components';
import { TraceToLogsData } from 'app/core/components/TraceToLogs/TraceToLogsSettings';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { getTimeZone } from 'app/features/profile/state/selectors';
import { StoreState } from 'app/types';
import { ExploreId } from 'app/types/explore';
import React, { RefObject, useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { changePanelState } from '../state/explorePane';
import { createSpanLinkFactory } from './createSpanLink';
import { useDetailState } from './useDetailState';
import { useHoverIndentGuide } from './useHoverIndentGuide';
import { useViewRange } from './useViewRange';

function noop(): {} {
  return {};
}

type Props = {
  dataFrames: DataFrame[];
  splitOpenFn: SplitOpen;
  exploreId: ExploreId;
  scrollElement?: Element;
  topOfExploreViewRef?: RefObject<HTMLDivElement>;
  traceProp: Trace;
  spanFindMatches?: Set<string>;
  search: string;
  focusedSpanIdForSearch: string;
  expandOne: (spans: TraceSpan[]) => void;
  expandAll: () => void;
  collapseOne: (spans: TraceSpan[]) => void;
  collapseAll: (spans: TraceSpan[]) => void;
  childrenToggle: (spanId: string) => void;
  childrenHiddenIDs: Set<string>;
  queryResponse: PanelData;
};

export function TraceView(props: Props) {
  const {
    expandOne,
    expandAll,
    collapseOne,
    collapseAll,
    childrenToggle,
    childrenHiddenIDs,
    spanFindMatches,
    traceProp,
  } = props;

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
  } = useDetailState(props.dataFrames[0]);

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

  const datasource = useSelector(
    (state: StoreState) => state.explore[props.exploreId]?.datasourceInstance ?? undefined
  );

  const [focusedSpanId, createFocusSpanLink] = useFocusSpanLink({
    refId: props.dataFrames[0]?.refId,
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
      traceID: props.traceProp?.traceID,
    }),
    [childrenHiddenIDs, detailStates, hoverIndentGuideIds, spanNameColumnWidth, props.traceProp?.traceID]
  );

  useEffect(() => {
    if (props.queryResponse.state === LoadingState.Done) {
      props.topOfExploreViewRef?.current?.scrollIntoView();
    }
  }, [props.queryResponse, props.topOfExploreViewRef]);

  const traceToLogsOptions = (getDatasourceSrv().getInstanceSettings(datasource?.name)?.jsonData as TraceToLogsData)
    ?.tracesToLogs;
  const createSpanLink = useMemo(
    () => createSpanLinkFactory({ splitOpenFn: props.splitOpenFn, traceToLogsOptions, dataFrame: props.dataFrames[0] }),
    [props.splitOpenFn, traceToLogsOptions, props.dataFrames]
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
        hideMap={false}
        hideSummary={false}
        onSlimViewClicked={onSlimViewClicked}
        onTraceGraphViewClicked={noop}
        slimView={slim}
        trace={traceProp}
        updateNextViewRangeTime={updateNextViewRangeTime}
        updateViewRangeTime={updateViewRangeTime}
        viewRange={viewRange}
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
        uiFind={props.search}
        createSpanLink={createSpanLink}
        scrollElement={props.scrollElement}
        focusedSpanId={focusedSpanId}
        focusedSpanIdForSearch={props.focusedSpanIdForSearch}
        createFocusSpanLink={createFocusSpanLink}
        topOfExploreViewRef={props.topOfExploreViewRef}
      />
    </>
  );
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
