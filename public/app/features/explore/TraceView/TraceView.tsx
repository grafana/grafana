import { TraceViewData } from '@grafana/data';
import { colors, useTheme } from '@grafana/ui';
import {
  ThemeOptions,
  ThemeProvider,
  ThemeType,
  TracePageHeader,
  TraceTimelineViewer,
  transformTraceData,
  TTraceTimeline,
  UIElementsContext,
} from '@jaegertracing/jaeger-ui-components';
import { TraceToLogsData } from 'app/core/components/TraceToLogsSettings';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { StoreState } from 'app/types';
import { ExploreId, SplitOpen } from 'app/types/explore';
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
  trace?: TraceViewData;
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

  const traceProp = useMemo(() => transformTraceData(props.trace), [props.trace]);
  const { search, setSearch, spanFindMatches } = useSearch(traceProp?.spans);
  const dataSourceName = useSelector((state: StoreState) => state.explore[props.exploreId]?.datasourceInstance?.name);
  const traceToLogsOptions = (getDatasourceSrv().getInstanceSettings(dataSourceName)?.jsonData as TraceToLogsData)
    ?.tracesToLogs;

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

  const createSpanLink = useMemo(() => createSpanLinkFactory(props.splitOpenFn, traceToLogsOptions), [
    props.splitOpenFn,
    traceToLogsOptions,
  ]);
  const scrollElement = document.getElementsByClassName('scrollbar-view')[0];
  const onSlimViewClicked = useCallback(() => setSlim(!slim), [slim]);

  if (!props.trace?.traceID) {
    return null;
  }

  if (!traceProp) {
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
