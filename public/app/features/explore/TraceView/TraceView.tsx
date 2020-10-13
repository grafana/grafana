import React, { useCallback, useMemo, useState } from 'react';
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
import { UIElements } from './uiElements';
import { useViewRange } from './useViewRange';
import { useSearch } from './useSearch';
import { useChildrenState } from './useChildrenState';
import { useDetailState } from './useDetailState';
import { useHoverIndentGuide } from './useHoverIndentGuide';
import { colors, useTheme } from '@grafana/ui';
import {
  TraceData,
  TraceSpanData,
  Trace,
  TraceSpan,
  TraceKeyValuePair,
  TraceLink,
  mapInternalLinkToExplore,
  DataLink,
  dateTime,
  TimeRange,
  Field,
} from '@grafana/data';
import { LokiQuery } from '../../../plugins/datasource/loki/types';
import { getDataSourceSrv, getTemplateSrv, config } from '@grafana/runtime';

type Props = {
  trace: TraceData & { spans: TraceSpanData[] };
  splitOpenFn: (options: { datasourceUid: string; query: any }) => void;
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

  const createSpanLink = useMemo(() => createSpanLinkFactory(props.splitOpenFn), [props.splitOpenFn]);

  if (!traceProp) {
    return null;
  }

  return (
    <ThemeProvider value={traceTheme}>
      <UIElementsContext.Provider value={UIElements}>
        <TracePageHeader
          canCollapse={false}
          clearSearch={useCallback(() => {}, [])}
          focusUiFindMatches={useCallback(() => {}, [])}
          hideMap={false}
          hideSummary={false}
          nextResult={useCallback(() => {}, [])}
          onSlimViewClicked={useCallback(() => setSlim(!slim), [])}
          onTraceGraphViewClicked={useCallback(() => {}, [])}
          prevResult={useCallback(() => {}, [])}
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
          registerAccessors={useCallback(() => {}, [])}
          scrollToFirstVisibleSpan={useCallback(() => {}, [])}
          findMatchesIDs={spanFindMatches}
          trace={traceProp}
          traceTimeline={traceTimeline}
          updateNextViewRangeTime={updateNextViewRangeTime}
          updateViewRangeTime={updateViewRangeTime}
          viewRange={viewRange}
          focusSpan={useCallback(() => {}, [])}
          createLinkToExternalSpan={useCallback(() => '', [])}
          setSpanNameColumnWidth={setSpanNameColumnWidth}
          collapseAll={collapseAll}
          collapseOne={collapseOne}
          expandAll={expandAll}
          expandOne={expandOne}
          childrenToggle={childrenToggle}
          clearShouldScrollToFirstUiFindMatch={useCallback(() => {}, [])}
          detailLogItemToggle={detailLogItemToggle}
          detailLogsToggle={detailLogsToggle}
          detailWarningsToggle={detailWarningsToggle}
          detailStackTracesToggle={detailStackTracesToggle}
          detailReferencesToggle={detailReferencesToggle}
          detailProcessToggle={detailProcessToggle}
          detailTagsToggle={detailTagsToggle}
          detailToggle={toggleDetail}
          setTrace={useCallback((trace: Trace | null, uiFind: string | null) => {}, [])}
          addHoverIndentGuideId={addHoverIndentGuideId}
          removeHoverIndentGuideId={removeHoverIndentGuideId}
          linksGetter={useCallback(
            (span: TraceSpan, items: TraceKeyValuePair[], itemIndex: number) => [] as TraceLink[],
            []
          )}
          uiFind={search}
          createSpanLink={createSpanLink}
        />
      </UIElementsContext.Provider>
    </ThemeProvider>
  );
}

const allowedKeys = ['cluster', 'hostname', 'namespace', 'pod'];

function createSpanLinkFactory(splitOpenFn: (options: { datasourceUid: string; query: any }) => void) {
  if (!config.featureToggles.traceToLogs) {
    return undefined;
  }

  // Right now just hardcoded for first loki DS we can find
  const lokiDs = getDataSourceSrv()
    .getExternal()
    .find(ds => ds.meta.id === 'loki');

  if (!lokiDs) {
    return undefined;
  }

  return function(span: TraceSpan) {
    const tags = span.process.tags.reduce((acc, tag) => {
      if (allowedKeys.includes(tag.key)) {
        acc.push(`${tag.key}="${tag.value}"`);
      }
      return acc;
    }, [] as string[]);
    const query = `{${tags.join(', ')}}`;

    const dataLink: DataLink<LokiQuery> = {
      title: 'Loki',
      url: '',
      internal: {
        datasourceUid: lokiDs!.uid,
        query: {
          expr: query,
          refId: '',
        },
      },
    };
    const range: TimeRange = {
      from: dateTime(span.startTime / 1000),
      to: dateTime(span.startTime / 1000 + span.duration / 1000),
      // Weirdly this needs to be string because Explore does not handle ISO string which would have been in the
      // URL if we just left this as object :( .
      // TODO: fix that somewhere, ideally just allow ISO string dates in the url
      raw: {
        from: dateTime(span.startTime / 1000)
          .valueOf()
          .toString(),
        to: dateTime(span.startTime / 1000 + span.duration / 1000)
          .valueOf()
          .toString(),
      },
    };
    const link = mapInternalLinkToExplore(dataLink, {}, range, {} as Field, {
      onClickFn: splitOpenFn,
      replaceVariables: getTemplateSrv().replace.bind(getTemplateSrv()),
      getDataSourceSettingsByUid: getDataSourceSrv().getDataSourceSettingsByUid.bind(getDataSourceSrv()),
    });
    return { href: link.href, onClick: link.onClick, content: 'Link to loki' };
  };
}
