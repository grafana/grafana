import { css } from '@emotion/css';
import React, { RefObject, useMemo, useState } from 'react';

import {
  DataFrame,
  DataLink,
  DataSourceApi,
  DataSourceJsonData,
  Field,
  GrafanaTheme2,
  LinkModel,
  mapInternalLinkToExplore,
  PanelData,
  SplitOpen,
} from '@grafana/data';
import { config, getTemplateSrv } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { useStyles2 } from '@grafana/ui';
import { getTraceToLogsOptions, TraceToLogsData } from 'app/core/components/TraceToLogs/TraceToLogsSettings';
import { TraceToMetricsData } from 'app/core/components/TraceToMetrics/TraceToMetricsSettings';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { getTimeZone } from 'app/features/profile/state/selectors';
import { TempoQuery } from 'app/plugins/datasource/tempo/types';
import { useDispatch, useSelector } from 'app/types';
import { ExploreId } from 'app/types/explore';

import { changePanelState } from '../state/explorePane';

import {
  SpanBarOptionsData,
  Trace,
  TracePageHeader,
  NewTracePageHeader,
  TraceTimelineViewer,
  TTraceTimeline,
} from './components';
import { TopOfViewRefType } from './components/TraceTimelineViewer/VirtualizedTraceView';
import { createSpanLinkFactory } from './createSpanLink';
import { useChildrenState } from './useChildrenState';
import { useDetailState } from './useDetailState';
import { useHoverIndentGuide } from './useHoverIndentGuide';
import { useViewRange } from './useViewRange';

const getStyles = (theme: GrafanaTheme2) => ({
  noDataMsg: css`
    height: 100%;
    width: 100%;
    display: grid;
    place-items: center;
    font-size: ${theme.typography.h4.fontSize};
    color: ${theme.colors.text.secondary};
  `,
});

function noop(): {} {
  return {};
}

type Props = {
  dataFrames: DataFrame[];
  splitOpenFn?: SplitOpen;
  exploreId?: ExploreId;
  scrollElement?: Element;
  traceProp: Trace;
  spanFindMatches?: Set<string>;
  search: string;
  focusedSpanIdForSearch: string;
  queryResponse: PanelData;
  datasource: DataSourceApi<DataQuery, DataSourceJsonData, {}> | undefined;
  topOfViewRef: RefObject<HTMLDivElement>;
  topOfViewRefType: TopOfViewRefType;
};

export function TraceView(props: Props) {
  const { spanFindMatches, traceProp, datasource, topOfViewRef, topOfViewRefType } = props;

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
  const { expandOne, collapseOne, childrenToggle, collapseAll, childrenHiddenIDs, expandAll } = useChildrenState();

  const styles = useStyles2(getStyles);

  /**
   * Keeps state of resizable name column width
   */
  const [spanNameColumnWidth, setSpanNameColumnWidth] = useState(0.25);

  const [focusedSpanId, createFocusSpanLink] = useFocusSpanLink({
    refId: props.dataFrames[0]?.refId,
    exploreId: props.exploreId!,
    datasource,
    splitOpenFn: props.splitOpenFn!,
  });

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

  const instanceSettings = getDatasourceSrv().getInstanceSettings(datasource?.name);
  const traceToLogsOptions = getTraceToLogsOptions(instanceSettings?.jsonData as TraceToLogsData);
  const traceToMetricsOptions = (instanceSettings?.jsonData as TraceToMetricsData)?.tracesToMetrics;
  const spanBarOptions: SpanBarOptionsData | undefined = instanceSettings?.jsonData;

  const createSpanLink = useMemo(
    () =>
      createSpanLinkFactory({
        splitOpenFn: props.splitOpenFn!,
        traceToLogsOptions,
        traceToMetricsOptions,
        dataFrame: props.dataFrames[0],
        createFocusSpanLink,
        trace: traceProp,
      }),
    [props.splitOpenFn, traceToLogsOptions, traceToMetricsOptions, props.dataFrames, createFocusSpanLink, traceProp]
  );
  const timeZone = useSelector((state) => getTimeZone(state.user));
  const datasourceType = datasource ? datasource?.type : 'unknown';

  return (
    <>
      {props.dataFrames?.length && traceProp ? (
        <>
          {config.featureToggles.newTraceView ? (
            <NewTracePageHeader
              trace={traceProp}
              updateNextViewRangeTime={updateNextViewRangeTime}
              updateViewRangeTime={updateViewRangeTime}
              viewRange={viewRange}
              timeZone={timeZone}
            />
          ) : (
            <TracePageHeader
              trace={traceProp}
              updateNextViewRangeTime={updateNextViewRangeTime}
              updateViewRangeTime={updateViewRangeTime}
              viewRange={viewRange}
              timeZone={timeZone}
            />
          )}
          <TraceTimelineViewer
            registerAccessors={noop}
            scrollToFirstVisibleSpan={noop}
            findMatchesIDs={spanFindMatches}
            trace={traceProp}
            datasourceType={datasourceType}
            spanBarOptions={spanBarOptions?.spanBar}
            traceTimeline={traceTimeline}
            updateNextViewRangeTime={updateNextViewRangeTime}
            updateViewRangeTime={updateViewRangeTime}
            viewRange={viewRange}
            timeZone={timeZone}
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
            linksGetter={() => []}
            uiFind={props.search}
            createSpanLink={createSpanLink}
            scrollElement={props.scrollElement}
            focusedSpanId={focusedSpanId}
            focusedSpanIdForSearch={props.focusedSpanIdForSearch!}
            createFocusSpanLink={createFocusSpanLink}
            topOfViewRef={topOfViewRef}
            topOfViewRefType={topOfViewRefType}
          />
        </>
      ) : (
        <div className={styles.noDataMsg}>No data</div>
      )}
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
  splitOpenFn: SplitOpen;
  refId?: string;
  datasource?: DataSourceApi;
}): [string | undefined, (traceId: string, spanId: string) => LinkModel<Field>] {
  const panelState = useSelector((state) => state.explore[options.exploreId]?.panelsState.trace);
  const focusedSpanId = panelState?.spanId;

  const dispatch = useDispatch();
  const setFocusedSpanId = (spanId?: string) =>
    dispatch(
      changePanelState(options.exploreId, 'trace', {
        ...panelState,
        spanId,
      })
    );

  const query = useSelector((state) =>
    state.explore[options.exploreId]?.queries.find((query) => query.refId === options.refId)
  );

  const createFocusSpanLink = (traceId: string, spanId: string) => {
    const link: DataLink = {
      title: 'Deep link to this span',
      url: '',
      internal: {
        datasourceUid: options.datasource?.uid!,
        datasourceName: options.datasource?.name!,
        query: {
          ...query,
          query: traceId,
        },
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
    const sameTrace = query?.queryType === 'traceId' && (query as TempoQuery).query === traceId;

    return mapInternalLinkToExplore({
      link,
      internalLink: link.internal!,
      scopedVars: {},
      range: {} as any,
      field: {} as Field,
      onClickFn: sameTrace
        ? () => setFocusedSpanId(focusedSpanId === spanId ? undefined : spanId)
        : options.splitOpenFn
        ? () =>
            options.splitOpenFn({
              datasourceUid: options.datasource?.uid!,
              query: {
                ...query!,
                query: traceId,
              },
              panelsState: {
                trace: {
                  spanId,
                },
              },
            })
        : undefined,
      replaceVariables: getTemplateSrv().replace.bind(getTemplateSrv()),
    });
  };

  return [focusedSpanId, createFocusSpanLink];
}
