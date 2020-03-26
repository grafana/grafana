import {
  DetailState,
  KeyValuePair,
  Link,
  Log,
  Span,
  // SpanData,
  // SpanReference,
  Trace,
  TraceTimelineViewer,
  TTraceTimeline,
  UIElementsContext,
  ViewRangeTimeUpdate,
  transformTraceData,
  SpanData,
  TraceData,
} from '@jaegertracing/jaeger-ui-components';
import React, { useState } from 'react';

type Props = {
  trace: TraceData & { spans: SpanData[] };
};

export function TraceView(props: Props) {
  /**
   * Track whether details are open per span.
   */
  const [detailStates, setDetailStates] = useState(new Map<string, DetailState>());

  /**
   * Track whether span is collapsed, meaning its children spans are hidden.
   */
  const [childrenHiddenIDs, setChildrenHiddenIDs] = useState(new Set<string>());

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

  function toggleDetail(spanID: string) {
    const newDetailStates = new Map(detailStates);
    if (newDetailStates.has(spanID)) {
      newDetailStates.delete(spanID);
    } else {
      newDetailStates.set(spanID, new DetailState());
    }
    setDetailStates(newDetailStates);
  }

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

  const traceProp = transformTraceData(props.trace);

  return (
    <UIElementsContext.Provider
      value={{
        Popover: (() => null as any) as any,
        Tooltip: (() => null as any) as any,
        Icon: (() => null as any) as any,
        Dropdown: (() => null as any) as any,
        Menu: (() => null as any) as any,
        MenuItem: (() => null as any) as any,
        Button: (() => null as any) as any,
        Divider: (() => null as any) as any,
      }}
    >
      <TraceTimelineViewer
        registerAccessors={() => {}}
        scrollToFirstVisibleSpan={() => {}}
        findMatchesIDs={null}
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
        updateNextViewRangeTime={(update: ViewRangeTimeUpdate) => {}}
        updateViewRangeTime={() => {}}
        viewRange={{ time: { current: [0, 1], cursor: null } }}
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
        uiFind={undefined}
      />
    </UIElementsContext.Provider>
  );
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
