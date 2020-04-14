import React, { useState } from 'react';
import {
  KeyValuePair,
  Link,
  Span,
  SpanData,
  ThemeProvider,
  ThemeType,
  Trace,
  TraceData,
  TracePageHeader,
  TraceTimelineViewer,
  transformTraceData,
  TTraceTimeline,
  UIElementsContext,
} from '@jaegertracing/jaeger-ui-components';
import { UIElements } from './uiElements';
import { useViewRange } from './useViewRange';
import { useSearch } from './useSearch';
import { useChildrenState } from './useChildrenState';
import { useDetailState } from './useDetailState';
import { useHoverIndentGuide } from './useHoverIndentGuide';
import { useTheme } from '@grafana/ui';

type Props = {
  trace: TraceData & { spans: SpanData[] };
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

  const traceProp = transformTraceData(props.trace);
  const { search, setSearch, spanFindMatches } = useSearch(traceProp?.spans);
  const theme = useTheme();

  return (
    <ThemeProvider
      value={{
        type: theme.isDark ? ThemeType.Dark : ThemeType.Light,
      }}
    >
      <UIElementsContext.Provider value={UIElements}>
        <TracePageHeader
          canCollapse={true}
          clearSearch={() => {}}
          focusUiFindMatches={() => {}}
          hideMap={false}
          hideSummary={false}
          nextResult={() => {}}
          onSlimViewClicked={() => setSlim(!slim)}
          onTraceGraphViewClicked={() => {}}
          prevResult={() => {}}
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
          registerAccessors={() => {}}
          scrollToFirstVisibleSpan={() => {}}
          findMatchesIDs={spanFindMatches}
          trace={traceProp}
          traceTimeline={
            {
              childrenHiddenIDs,
              detailStates,
              hoverIndentGuideIds,
              shouldScrollToFirstUiFindMatch: false,
              spanNameColumnWidth,
              traceID: '50b96206cf81dd64',
            } as TTraceTimeline
          }
          updateNextViewRangeTime={updateNextViewRangeTime}
          updateViewRangeTime={updateViewRangeTime}
          viewRange={viewRange}
          focusSpan={() => {}}
          createLinkToExternalSpan={() => ''}
          setSpanNameColumnWidth={setSpanNameColumnWidth}
          collapseAll={collapseAll}
          collapseOne={collapseOne}
          expandAll={expandAll}
          expandOne={expandOne}
          childrenToggle={childrenToggle}
          clearShouldScrollToFirstUiFindMatch={() => {}}
          detailLogItemToggle={detailLogItemToggle}
          detailLogsToggle={detailLogsToggle}
          detailWarningsToggle={detailWarningsToggle}
          detailReferencesToggle={detailReferencesToggle}
          detailProcessToggle={detailProcessToggle}
          detailTagsToggle={detailTagsToggle}
          detailToggle={toggleDetail}
          setTrace={(trace: Trace | null, uiFind: string | null) => {}}
          addHoverIndentGuideId={addHoverIndentGuideId}
          removeHoverIndentGuideId={removeHoverIndentGuideId}
          linksGetter={(span: Span, items: KeyValuePair[], itemIndex: number) => [] as Link[]}
          uiFind={search}
        />
      </UIElementsContext.Provider>
    </ThemeProvider>
  );
}
