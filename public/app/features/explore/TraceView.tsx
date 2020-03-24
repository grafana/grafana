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
} from '@jaegertracing/jaeger-ui-components';
import React, { useState } from 'react';

type Props = {
  trace: Trace;
};

export function TraceView(props: Props) {
  const [detailStates, setDetailStates] = useState(new Map());
  const [childrenHiddenIDs, setChildrenHiddenIDs] = useState(new Set<string>());
  const [hoverIndentGuideIds, setHoverIndentGuideIds] = useState(new Set<string>());
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

  /**
   * For some reason this is used internally to handle hover state of indent guide. As indent guides are separate
   * components per each row/span and you need to highlight all in multiple rows to make the effect of single line
   * they need this kind of common imperative state changes.
   *
   * Ideally would be changed to trace view internal state.
   * @param spanID
   */
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

// function makeTrace(): Trace {
//   const spanRoot = {
//     traceID: '50b96206cf81dd64',
//     spanID: '50b96206cf81dd64',
//     operationName: 'HTTP POST - api_prom_push',
//     references: [] as any,
//     startTime: 1584051626572058,
//     duration: 763,
//     tags: [
//       { key: 'component', value: 'net/http' },
//       { key: 'http.method', value: 'POST' },
//       { key: 'http.status_code', value: 204 },
//       { key: 'http.url', value: '/api/prom/push' },
//       { key: 'internal.span.format', value: 'proto' },
//       { key: 'sampler.param', value: true },
//       { key: 'sampler.type', value: 'const' },
//       { key: 'span.kind', value: 'server' },
//     ],
//     logs: [
//       {
//         timestamp: 1584051626572105,
//         fields: [{ key: 'event', value: 'util.ParseProtoRequest[start reading]' }],
//       },
//       {
//         timestamp: 1584051626572118,
//         fields: [
//           { key: 'event', value: 'util.ParseProtoRequest[decompress]' },
//           { key: 'size', value: 330 },
//         ],
//       },
//       {
//         timestamp: 1584051626572122,
//         fields: [
//           { key: 'event', value: 'util.ParseProtoRequest[unmarshal]' },
//           { key: 'size', value: 500 },
//         ],
//       },
//     ],
//     processID: 'p1',
//     warnings: [] as any,
//     process: {
//       serviceName: 'loki-all',
//       tags: [
//         { key: 'client-uuid', value: '36e1d270cb524d68' },
//         { key: 'hostname', value: '33dc62b13c67' },
//         { key: 'ip', value: '172.18.0.5' },
//         { key: 'jaeger.version', value: 'Go-2.20.1' },
//       ],
//     },
//     relativeStartTime: 0,
//     depth: 0,
//     hasChildren: true,
//     subsidiarilyReferencedBy: [] as any,
//   };
//   const span2 = {
//     traceID: '50b96206cf81dd64',
//     spanID: '53cdf5cabb2f1390',
//     operationName: '/logproto.Pusher/Push',
//     references: [
//       {
//         refType: 'CHILD_OF' as SpanReference['refType'],
//         traceID: '50b96206cf81dd64',
//         spanID: '50b96206cf81dd64',
//         span: spanRoot,
//       },
//     ],
//     startTime: 1584051626572235,
//     duration: 550,
//     tags: [
//       { key: 'component', value: 'gRPC' },
//       { key: 'internal.span.format', value: 'proto' },
//       { key: 'span.kind', value: 'client' },
//     ],
//     logs: [] as any,
//     processID: 'p1',
//     warnings: [] as any,
//     relativeStartTime: 177,
//     depth: 1,
//     hasChildren: true,
//     subsidiarilyReferencedBy: [] as any,
//     process: {
//       serviceName: 'loki-all',
//       tags: [
//         { key: 'client-uuid', value: '36e1d270cb524d68' },
//         { key: 'hostname', value: '33dc62b13c67' },
//         { key: 'ip', value: '172.18.0.5' },
//         { key: 'jaeger.version', value: 'Go-2.20.1' },
//       ],
//     },
//   };
//   const span3 = {
//     traceID: '50b96206cf81dd64',
//     spanID: '0eca9ed08e8477ae',
//     operationName: '/logproto.Pusher/Push',
//     references: [
//       {
//         refType: 'CHILD_OF' as SpanReference['refType'],
//         traceID: '50b96206cf81dd64',
//         spanID: '53cdf5cabb2f1390',
//         span: span2,
//       },
//     ],
//     startTime: 1584051626572582,
//     duration: 32,
//     tags: [
//       { key: 'component', value: 'gRPC' },
//       { key: 'internal.span.format', value: 'proto' },
//       { key: 'span.kind', value: 'server' },
//     ],
//     logs: [] as NonNullable<SpanData['logs']>,
//     processID: 'p1',
//     warnings: [] as NonNullable<SpanData['warnings']>,
//     relativeStartTime: 524,
//     depth: 2,
//     hasChildren: false,
//     subsidiarilyReferencedBy: [] as any,
//     process: {
//       serviceName: 'loki-all',
//       tags: [
//         { key: 'client-uuid', value: '36e1d270cb524d68' },
//         { key: 'hostname', value: '33dc62b13c67' },
//         { key: 'ip', value: '172.18.0.5' },
//         { key: 'jaeger.version', value: 'Go-2.20.1' },
//       ],
//     },
//   };
//
//   return {
//     services: [{ name: 'loki-all', numberOfSpans: 3 }],
//     spans: [spanRoot, span2, span3],
//     traceID: '50b96206cf81dd64',
//     traceName: 'loki-all: HTTP POST - api_prom_push',
//     processes: {},
//     duration: 763,
//     startTime: 1584051626572058,
//     endTime: 1584051626572821,
//   };
// }
