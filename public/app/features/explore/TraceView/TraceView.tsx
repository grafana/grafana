import { DataFrame, DataFrameView, SplitOpen, TraceSpanRow } from '@grafana/data';
import { colors, useTheme } from '@grafana/ui';
import {
  ThemeOptions,
  ThemeProvider,
  ThemeType,
  Trace,
  TracePageHeader,
  TraceProcess,
  TraceResponse,
  TraceTimelineViewer,
  transformTraceData,
  TTraceTimeline,
  UIElementsContext,
} from '@jaegertracing/jaeger-ui-components';
import { TraceToLogsData } from 'app/core/components/TraceToLogsSettings';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { getTimeZone } from 'app/features/profile/state/selectors';
import { StoreState } from 'app/types';
import { ExploreId } from 'app/types/explore';
import React, { useCallback, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { createSpanLinkFactory } from './createSpanLink';
import { UIElements } from './uiElements';
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
};

export function TraceView(props: Props) {
  const { expandOne, collapseOne, childrenToggle, collapseAll, childrenHiddenIDs, expandAll } = useChildrenState();
  const {
    detailStates,
    toggleDetail,
    detailLogItemToggle,
    detailLogsToggle,
    detailProcessToggle,
    detailReferencesToggle,
    detailTagsToggle,
    detailWarningsToggle,
    detailStackTracesToggle,
  } = useDetailState();
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

  // At this point we only show single trace.
  const frame = props.dataFrames[0];
  const traceProp = useMemo(() => transformDataFrames(frame), [frame]);
  const { search, setSearch, spanFindMatches } = useSearch(traceProp?.spans);
  const dataSourceName = useSelector((state: StoreState) => state.explore[props.exploreId]?.datasourceInstance?.name);
  const traceToLogsOptions = (getDatasourceSrv().getInstanceSettings(dataSourceName)?.jsonData as TraceToLogsData)
    ?.tracesToLogs;
  const timeZone = useSelector((state: StoreState) => getTimeZone(state.user));

  const theme = useTheme();
  const traceTheme = useMemo(
    () =>
      ({
        type: theme.isDark ? ThemeType.Dark : ThemeType.Light,
        servicesColorPalette: colors,
        components: {
          TraceName: {
            fontSize: theme.typography.size.lg,
          },
        },
      } as ThemeOptions),
    [theme]
  );

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

  const createSpanLink = useMemo(
    () => createSpanLinkFactory({ splitOpenFn: props.splitOpenFn, traceToLogsOptions, dataFrame: frame }),
    [props.splitOpenFn, traceToLogsOptions, frame]
  );
  const scrollElement = document.getElementsByClassName('scrollbar-view')[0];
  const onSlimViewClicked = useCallback(() => setSlim(!slim), [slim]);

  if (!props.dataFrames?.length || !traceProp) {
    return null;
  }

  return (
    <ThemeProvider value={traceTheme}>
      <UIElementsContext.Provider value={UIElements}>
        <TracePageHeader
          canCollapse={false}
          clearSearch={noop}
          focusUiFindMatches={noop}
          hideMap={false}
          hideSummary={false}
          nextResult={noop}
          onSlimViewClicked={onSlimViewClicked}
          onTraceGraphViewClicked={noop}
          prevResult={noop}
          resultCount={0}
          slimView={slim}
          textFilter={null}
          trace={traceProp}
          traceGraphView={false}
          updateNextViewRangeTime={updateNextViewRangeTime}
          updateViewRangeTime={updateViewRangeTime}
          viewRange={viewRange}
          searchValue={search}
          onSearchValueChange={setSearch}
          hideSearchButtons={true}
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
          createLinkToExternalSpan={noop as any}
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
          detailProcessToggle={detailProcessToggle}
          detailTagsToggle={detailTagsToggle}
          detailToggle={toggleDetail}
          setTrace={noop}
          addHoverIndentGuideId={addHoverIndentGuideId}
          removeHoverIndentGuideId={removeHoverIndentGuideId}
          linksGetter={noop as any}
          uiFind={search}
          createSpanLink={createSpanLink}
          scrollElement={scrollElement}
        />
      </UIElementsContext.Provider>
    </ThemeProvider>
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
      return {
        ...s,
        duration: s.duration * 1000,
        startTime: s.startTime * 1000,
        processID: s.spanID,
        flags: 0,
        references: s.parentSpanID ? [{ refType: 'CHILD_OF', spanID: s.parentSpanID, traceID: s.traceID }] : undefined,
        logs: s.logs?.map((l) => ({ ...l, timestamp: l.timestamp * 1000 })) || [],
        dataFrameRowIndex: index,
      };
    }),
  };
}
