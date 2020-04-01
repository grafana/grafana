import {
  DetailState,
  KeyValuePair,
  Link,
  Log,
  Span,
  Trace,
  TraceTimelineViewer,
  TTraceTimeline,
  UIElementsContext,
  ViewRangeTimeUpdate,
  transformTraceData,
  SpanData,
  TraceData,
  TracePageHeader,
  ViewRange,
  ButtonProps,
  Elements,
} from '@jaegertracing/jaeger-ui-components';
import React, { useState } from 'react';
import { Button, Input } from '@grafana/ui';
import filterSpans from '@jaegertracing/jaeger-ui-components/src/utils/filter-spans';

type Props = {
  trace: TraceData & { spans: SpanData[] };
};

export function TraceView(props: Props) {
  /**
   * Track whether details are open per span.
   */
  const [detailStates, setDetailStates] = useState(new Map<string, DetailState>());

  function toggleDetail(spanID: string) {
    const newDetailStates = new Map(detailStates);
    if (newDetailStates.has(spanID)) {
      newDetailStates.delete(spanID);
    } else {
      newDetailStates.set(spanID, new DetailState());
    }
    setDetailStates(newDetailStates);
  }

  /**
   * Track whether span is collapsed, meaning its children spans are hidden.
   */
  const [childrenHiddenIDs, setChildrenHiddenIDs] = useState(new Set<string>());

  function expandOne(spans: Span[]) {
    if (childrenHiddenIDs.size === 0) {
      return;
    }
    let prevExpandedDepth = -1;
    let expandNextHiddenSpan = true;
    const newChildrenHiddenIDs = spans.reduce((res, s) => {
      if (s.depth <= prevExpandedDepth) {
        expandNextHiddenSpan = true;
      }
      if (expandNextHiddenSpan && res.has(s.spanID)) {
        res.delete(s.spanID);
        expandNextHiddenSpan = false;
        prevExpandedDepth = s.depth;
      }
      return res;
    }, new Set(childrenHiddenIDs));
    setChildrenHiddenIDs(newChildrenHiddenIDs);
  }

  function collapseOne(spans: Span[]) {
    if (shouldDisableCollapse(spans, childrenHiddenIDs)) {
      return;
    }
    let nearestCollapsedAncestor: Span | undefined;
    const newChildrenHiddenIDs = spans.reduce((res, curSpan) => {
      if (nearestCollapsedAncestor && curSpan.depth <= nearestCollapsedAncestor.depth) {
        res.add(nearestCollapsedAncestor.spanID);
        if (curSpan.hasChildren) {
          nearestCollapsedAncestor = curSpan;
        }
      } else if (curSpan.hasChildren && !res.has(curSpan.spanID)) {
        nearestCollapsedAncestor = curSpan;
      }
      return res;
    }, new Set(childrenHiddenIDs));
    // The last one
    if (nearestCollapsedAncestor) {
      newChildrenHiddenIDs.add(nearestCollapsedAncestor.spanID);
    }
    setChildrenHiddenIDs(newChildrenHiddenIDs);
  }

  function expandAll() {
    setChildrenHiddenIDs(new Set<string>());
  }

  function collapseAll(spans: Span[]) {
    if (shouldDisableCollapse(spans, childrenHiddenIDs)) {
      return;
    }
    const newChildrenHiddenIDs = spans.reduce((res, s) => {
      if (s.hasChildren) {
        res.add(s.spanID);
      }
      return res;
    }, new Set<string>());

    setChildrenHiddenIDs(newChildrenHiddenIDs);
  }

  function childrenToggle(spanID: string) {
    const newChildrenHiddenIDs = new Set(childrenHiddenIDs);
    if (childrenHiddenIDs.has(spanID)) {
      newChildrenHiddenIDs.delete(spanID);
    } else {
      newChildrenHiddenIDs.add(spanID);
    }
    setChildrenHiddenIDs(newChildrenHiddenIDs);
  }

  /**
   * For some reason this is used internally to handle hover state of indent guide. As indent guides are separate
   * components per each row/span and you need to highlight all in multiple rows to make the effect of single line
   * they need this kind of common imperative state changes.
   *
   * Ideally would be changed to trace view internal state.
   */
  const [hoverIndentGuideIds, setHoverIndentGuideIds] = useState(new Set<string>());

  /**
   * Keeps state of resizable name column
   */
  const [spanNameColumnWidth, setSpanNameColumnWidth] = useState(0.25);

  function detailLogItemToggle(spanID: string, log: Log) {
    const old = detailStates.get(spanID);
    if (!old) {
      return;
    }
    const detailState = old.toggleLogItem(log);
    const newDetailStates = new Map(detailStates);
    newDetailStates.set(spanID, detailState);
    return setDetailStates(newDetailStates);
  }

  function addHoverIndentGuideId(spanID: string) {
    setHoverIndentGuideIds(prevState => {
      const newHoverIndentGuideIds = new Set(prevState);
      newHoverIndentGuideIds.add(spanID);
      return newHoverIndentGuideIds;
    });
  }

  function removeHoverIndentGuideId(spanID: string) {
    setHoverIndentGuideIds(prevState => {
      const newHoverIndentGuideIds = new Set(prevState);
      newHoverIndentGuideIds.delete(spanID);
      return newHoverIndentGuideIds;
    });
  }

  const { viewRange, updateViewRangeTime, updateNextViewRangeTime } = useViewRange();

  const traceProp = transformTraceData(props.trace);
  const { search, setSearch, spanFindMatches } = useSearch(traceProp?.spans);

  // Slim means the top minimap is hidden
  const [slim, setSlim] = useState(false);

  return (
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
        detailLogsToggle={makeDetailSubsectionToggle('logs', detailStates, setDetailStates)}
        detailWarningsToggle={makeDetailSubsectionToggle('warnings', detailStates, setDetailStates)}
        detailReferencesToggle={makeDetailSubsectionToggle('references', detailStates, setDetailStates)}
        detailProcessToggle={makeDetailSubsectionToggle('process', detailStates, setDetailStates)}
        detailTagsToggle={makeDetailSubsectionToggle('tags', detailStates, setDetailStates)}
        detailToggle={toggleDetail}
        setTrace={(trace: Trace | null, uiFind: string | null) => {}}
        addHoverIndentGuideId={addHoverIndentGuideId}
        removeHoverIndentGuideId={removeHoverIndentGuideId}
        linksGetter={(span: Span, items: KeyValuePair[], itemIndex: number) => [] as Link[]}
        uiFind={search}
      />
    </UIElementsContext.Provider>
  );
}

const UIElements: Elements = {
  Popover: (() => null as any) as any,
  Tooltip: (() => null as any) as any,
  Icon: (() => null as any) as any,
  Dropdown: (() => null as any) as any,
  Menu: (() => null as any) as any,
  MenuItem: (() => null as any) as any,
  Button: ({ onClick, children, className }: ButtonProps) => (
    <Button variant={'secondary'} onClick={onClick} className={className}>
      {children}
    </Button>
  ),
  Divider,
  Input: props => <Input {...props} />,
  InputGroup: ({ children, className, style }) => (
    <span className={className} style={style}>
      {children}
    </span>
  ),
};

function Divider({ className }: { className?: string }) {
  return (
    <div
      style={{
        display: 'inline-block',
        background: '#e8e8e8',
        width: '1px',
        height: '0.9em',
        margin: '0 8px',
      }}
      className={className}
    ></div>
  );
}

/**
 * Controls state of the zoom function that can be used through minimap in header or on the timeline.
 */
function useViewRange() {
  const [viewRange, setViewRange] = useState<ViewRange>({
    time: {
      current: [0, 1],
    },
  });

  function updateNextViewRangeTime(update: ViewRangeTimeUpdate) {
    setViewRange(
      (prevRange): ViewRange => {
        const time = { ...prevRange.time, ...update };
        return { ...prevRange, time };
      }
    );
  }

  function updateViewRangeTime(start: number, end: number) {
    const current: [number, number] = [start, end];
    const time = { current };
    setViewRange(
      (prevRange): ViewRange => {
        return { ...prevRange, time };
      }
    );
  }

  return { viewRange, updateViewRangeTime, updateNextViewRangeTime };
}

function useSearch(spans?: Span[]) {
  const [search, setSearch] = useState('');
  let spanFindMatches;
  if (search && spans) {
    spanFindMatches = filterSpans(search, spans);
  }
  return { search, setSearch, spanFindMatches };
}

function shouldDisableCollapse(allSpans: Span[], hiddenSpansIds: Set<string>) {
  const allParentSpans = allSpans.filter(s => s.hasChildren);
  return allParentSpans.length === hiddenSpansIds.size;
}

function makeDetailSubsectionToggle(
  subSection: 'tags' | 'process' | 'logs' | 'warnings' | 'references',
  detailStates: Map<string, DetailState>,
  setDetailStates: (detailStates: Map<string, DetailState>) => void
) {
  return (spanID: string) => {
    const old = detailStates.get(spanID);
    if (!old) {
      return;
    }
    let detailState;
    if (subSection === 'tags') {
      detailState = old.toggleTags();
    } else if (subSection === 'process') {
      detailState = old.toggleProcess();
    } else if (subSection === 'warnings') {
      detailState = old.toggleWarnings();
    } else if (subSection === 'references') {
      detailState = old.toggleReferences();
    } else {
      detailState = old.toggleLogs();
    }
    const newDetailStates = new Map(detailStates);
    newDetailStates.set(spanID, detailState);
    setDetailStates(newDetailStates);
  };
}
