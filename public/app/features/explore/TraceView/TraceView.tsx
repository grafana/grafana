import { css } from '@emotion/css';
import { RefObject, useMemo, useState } from 'react';
import { useToggle } from 'react-use';

import {
  CoreApp,
  DataFrame,
  DataLink,
  DataSourceApi,
  DataSourceJsonData,
  Field,
  GrafanaTheme2,
  LinkModel,
  mapInternalLinkToExplore,
  SplitOpen,
} from '@grafana/data';
import { getTraceToLogsOptions, TraceToMetricsData, TraceToProfilesData } from '@grafana/o11y-ds-frontend';
import { getTemplateSrv } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { useStyles2 } from '@grafana/ui';
import { TempoQuery } from '@grafana-plugins/tempo/types';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { getTimeZone } from 'app/features/profile/state/selectors';
import { useDispatch, useSelector } from 'app/types';

import { changePanelState } from '../state/explorePane';

import {
  SpanBarOptionsData,
  SpanLinkFunc,
  Trace,
  TracePageHeader,
  TraceTimelineViewer,
  TTraceTimeline,
} from './components';
import memoizedTraceCriticalPath from './components/CriticalPath';
import SpanGraph from './components/TracePageHeader/SpanGraph';
import { TraceFlameGraphs } from './components/TraceTimelineViewer/SpanDetail';
import { createSpanLinkFactory } from './createSpanLink';
import { useChildrenState } from './useChildrenState';
import { useDetailState } from './useDetailState';
import { useHoverIndentGuide } from './useHoverIndentGuide';
import { SearchProps, useSearch } from './useSearch';
import { useViewRange } from './useViewRange';

const getStyles = (theme: GrafanaTheme2) => ({
  noDataMsg: css({
    height: '100%',
    width: '100%',
    display: 'grid',
    placeItems: 'center',
    fontSize: theme.typography.h4.fontSize,
    color: theme.colors.text.secondary,
  }),
});

type Props = {
  dataFrames: DataFrame[];
  splitOpenFn?: SplitOpen;
  exploreId?: string;
  scrollElement?: Element;
  scrollElementClass?: string;
  traceProp: Trace;
  datasource: DataSourceApi<DataQuery, DataSourceJsonData, {}> | undefined;
  topOfViewRef?: RefObject<HTMLDivElement>;
  createSpanLink?: SpanLinkFunc;
  focusedSpanId?: string;
  createFocusSpanLink?: (traceId: string, spanId: string) => LinkModel<Field>;
  spanFilters?: SearchProps;
};

export function TraceView(props: Props) {
  const {
    traceProp,
    datasource,
    topOfViewRef,
    exploreId,
    createSpanLink: createSpanLinkFromProps,
    focusedSpanId: focusedSpanIdFromProps,
    createFocusSpanLink: createFocusSpanLinkFromProps,
    spanFilters,
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
  const { expandOne, collapseOne, childrenToggle, collapseAll, childrenHiddenIDs, expandAll } = useChildrenState();
  const { search, setSearch, spanFilterMatches } = useSearch(traceProp?.spans, spanFilters);
  const [focusedSpanIdForSearch, setFocusedSpanIdForSearch] = useState('');
  const [showSpanFilters, setShowSpanFilters] = useToggle(false);
  const [headerHeight, setHeaderHeight] = useState(100);
  const [traceFlameGraphs, setTraceFlameGraphs] = useState<TraceFlameGraphs>({});
  const [redrawListView, setRedrawListView] = useState({});

  const styles = useStyles2(getStyles);

  /**
   * Keeps state of resizable name column width
   */
  const [spanNameColumnWidth, setSpanNameColumnWidth] = useState(0.4);

  const [focusedSpanIdExplore, createFocusSpanLinkExplore] = useFocusSpanLink({
    refId: props.dataFrames[0]?.refId,
    exploreId: props.exploreId!,
    datasource,
    splitOpenFn: props.splitOpenFn!,
  });

  const focusedSpanId = focusedSpanIdFromProps ?? focusedSpanIdExplore;
  const createFocusSpanLink = createFocusSpanLinkFromProps ?? createFocusSpanLinkExplore;

  const traceTimeline: TTraceTimeline = useMemo(
    () => ({
      childrenHiddenIDs,
      detailStates,
      hoverIndentGuideIds,
      spanNameColumnWidth,
      traceID: props.traceProp?.traceID,
    }),
    [childrenHiddenIDs, detailStates, hoverIndentGuideIds, spanNameColumnWidth, props.traceProp?.traceID]
  );

  const instanceSettings = getDatasourceSrv().getInstanceSettings(datasource?.name);
  const traceToLogsOptions = getTraceToLogsOptions(instanceSettings?.jsonData);
  const traceToMetrics: TraceToMetricsData | undefined = instanceSettings?.jsonData;
  const traceToMetricsOptions = traceToMetrics?.tracesToMetrics;
  const traceToProfilesData: TraceToProfilesData | undefined = instanceSettings?.jsonData;
  const traceToProfilesOptions = traceToProfilesData?.tracesToProfiles;
  const spanBarOptions: SpanBarOptionsData | undefined = instanceSettings?.jsonData;

  const createSpanLink = useMemo(
    () =>
      createSpanLinkFromProps ??
      createSpanLinkFactory({
        splitOpenFn: props.splitOpenFn!,
        traceToLogsOptions,
        traceToMetricsOptions,
        traceToProfilesOptions,
        dataFrame: props.dataFrames[0],
        createFocusSpanLink,
        trace: traceProp,
      }),
    [
      props.splitOpenFn,
      traceToLogsOptions,
      traceToMetricsOptions,
      traceToProfilesOptions,
      props.dataFrames,
      createFocusSpanLink,
      traceProp,
      createSpanLinkFromProps,
    ]
  );
  const timeZone = useSelector((state) => getTimeZone(state.user));
  const datasourceType = datasource ? datasource?.type : 'unknown';
  const scrollElement = props.scrollElement
    ? props.scrollElement
    : document.getElementsByClassName(props.scrollElementClass ?? '')[0];

  const criticalPath = memoizedTraceCriticalPath(traceProp);

  return (
    <>
      {props.dataFrames?.length && traceProp ? (
        <>
          <TracePageHeader
            trace={traceProp}
            data={props.dataFrames[0]}
            timeZone={timeZone}
            search={search}
            setSearch={setSearch}
            showSpanFilters={showSpanFilters}
            setShowSpanFilters={setShowSpanFilters}
            setFocusedSpanIdForSearch={setFocusedSpanIdForSearch}
            spanFilterMatches={spanFilterMatches}
            datasourceType={datasourceType}
            setHeaderHeight={setHeaderHeight}
            app={exploreId ? CoreApp.Explore : CoreApp.Unknown}
          />
          <SpanGraph
            trace={traceProp}
            viewRange={viewRange}
            updateNextViewRangeTime={updateNextViewRangeTime}
            updateViewRangeTime={updateViewRangeTime}
          />
          <TraceTimelineViewer
            findMatchesIDs={spanFilterMatches}
            trace={traceProp}
            traceToProfilesOptions={traceToProfilesOptions}
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
            detailLogItemToggle={detailLogItemToggle}
            detailLogsToggle={detailLogsToggle}
            detailWarningsToggle={detailWarningsToggle}
            detailStackTracesToggle={detailStackTracesToggle}
            detailReferencesToggle={detailReferencesToggle}
            detailReferenceItemToggle={detailReferenceItemToggle}
            detailProcessToggle={detailProcessToggle}
            detailTagsToggle={detailTagsToggle}
            detailToggle={toggleDetail}
            addHoverIndentGuideId={addHoverIndentGuideId}
            removeHoverIndentGuideId={removeHoverIndentGuideId}
            linksGetter={() => []}
            createSpanLink={createSpanLink}
            scrollElement={scrollElement}
            focusedSpanId={focusedSpanId}
            focusedSpanIdForSearch={focusedSpanIdForSearch}
            showSpanFilterMatchesOnly={search.matchesOnly}
            showCriticalPathSpansOnly={search.criticalPathOnly}
            createFocusSpanLink={createFocusSpanLink}
            topOfViewRef={topOfViewRef}
            headerHeight={headerHeight}
            criticalPath={criticalPath}
            traceFlameGraphs={traceFlameGraphs}
            setTraceFlameGraphs={setTraceFlameGraphs}
            redrawListView={redrawListView}
            setRedrawListView={setRedrawListView}
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
  exploreId: string;
  splitOpenFn: SplitOpen;
  refId?: string;
  datasource?: DataSourceApi;
}): [string | undefined, (traceId: string, spanId: string) => LinkModel<Field>] {
  const panelState = useSelector((state) => state.explore.panes[options.exploreId]?.panelsState.trace);
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
    state.explore.panes[options.exploreId]?.queries.find((query) => query.refId === options.refId)
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
    const sameTrace = query?.queryType === 'traceql' && (query as TempoQuery).query === traceId;

    return mapInternalLinkToExplore({
      link,
      internalLink: link.internal!,
      scopedVars: {},
      field: {} as Field,
      onClickFn: sameTrace
        ? () => setFocusedSpanId(focusedSpanId === spanId ? undefined : spanId)
        : options.splitOpenFn
          ? () =>
              options.splitOpenFn({
                datasourceUid: options.datasource?.uid!,
                queries: [
                  {
                    ...query!,
                    query: traceId,
                  },
                ],
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
