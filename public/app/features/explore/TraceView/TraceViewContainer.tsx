import React, { RefObject, useMemo, useState } from 'react';
import { Collapse } from '@grafana/ui';
import { DataFrame, DataFrameView, SplitOpen, TraceSpanRow } from '@grafana/data';
import { TraceView } from './TraceView';
import { ExploreId } from 'app/types/explore';
import TracePageSearchBar from '@jaegertracing/jaeger-ui-components/src/TracePageHeader/TracePageSearchBar';
import { useSearch } from './useSearch';
import { Trace, TraceProcess, TraceResponse, transformTraceData } from '@jaegertracing/jaeger-ui-components';
import { useChildrenState } from './useChildrenState';
interface Props {
  dataFrames: DataFrame[];
  splitOpenFn: SplitOpen;
  exploreId: ExploreId;
  scrollElement?: Element;
  topOfExploreViewRef?: RefObject<HTMLDivElement>;
}
export function TraceViewContainer(props: Props) {
  // At this point we only show single trace
  const frame = props.dataFrames[0];

  const { dataFrames, splitOpenFn, exploreId, scrollElement, topOfExploreViewRef } = props;
  const traceProp = useMemo(() => transformDataFrames(frame), [frame]);
  const { search, setSearch, spanFindMatches, clearSearch } = useSearch(traceProp?.spans);
  const { expandOne, collapseOne, childrenToggle, collapseAll, childrenHiddenIDs, expandAll } = useChildrenState();

  const [focusedSpanIdForSearch, setFocusedSpanIdForSearch] = useState('');
  const [searchBarSuffix, setSearchBarSuffix] = useState('');

  const clearTraceSearch = () => {
    setFocusedSpanIdForSearch('');
    clearSearch();
  };

  const setTraceSearch = (value: string) => {
    setFocusedSpanIdForSearch('');
    setSearchBarSuffix('');
    setSearch(value);
  };

  const nextResult = () => {
    expandAll();
    const spanMatches = Array.from(spanFindMatches!);
    const prevMatchedIndex = spanMatches.indexOf(focusedSpanIdForSearch)
      ? spanMatches.indexOf(focusedSpanIdForSearch)
      : 0;

    // new query || at end, go to start
    if (prevMatchedIndex === -1 || prevMatchedIndex === spanMatches.length - 1) {
      setFocusedSpanIdForSearch(spanMatches[0]);
      setSearchBarSuffix(getSearchBarSuffix(1));
      return;
    }

    // get next
    setFocusedSpanIdForSearch(spanMatches[prevMatchedIndex + 1]);
    setSearchBarSuffix(getSearchBarSuffix(prevMatchedIndex + 2));
  };

  const prevResult = () => {
    expandAll();
    const spanMatches = Array.from(spanFindMatches!);
    const prevMatchedIndex = spanMatches.indexOf(focusedSpanIdForSearch)
      ? spanMatches.indexOf(focusedSpanIdForSearch)
      : 0;

    // new query || at start, go to end
    if (prevMatchedIndex === -1 || prevMatchedIndex === 0) {
      setFocusedSpanIdForSearch(spanMatches[spanMatches.length - 1]);
      setSearchBarSuffix(getSearchBarSuffix(spanMatches.length));
      return;
    }

    // get prev
    setFocusedSpanIdForSearch(spanMatches[prevMatchedIndex - 1]);
    setSearchBarSuffix(getSearchBarSuffix(prevMatchedIndex));
  };

  const getSearchBarSuffix = (index: number): string => {
    if (spanFindMatches?.size && spanFindMatches?.size > 0) {
      return index + ' of ' + spanFindMatches?.size;
    }
    return '';
  };

  if (!traceProp) {
    return null;
  }

  return (
    <>
      <TracePageSearchBar
        clearSearch={clearTraceSearch}
        nextResult={nextResult}
        prevResult={prevResult}
        navigable={true}
        searchValue={search}
        onSearchValueChange={setTraceSearch}
        searchBarSuffix={searchBarSuffix}
      />

      <Collapse label="Trace View" isOpen>
        <TraceView
          exploreId={exploreId}
          dataFrames={dataFrames}
          splitOpenFn={splitOpenFn}
          scrollElement={scrollElement}
          topOfExploreViewRef={topOfExploreViewRef}
          traceProp={traceProp}
          spanFindMatches={spanFindMatches}
          search={search}
          focusedSpanIdForSearch={focusedSpanIdForSearch}
          expandOne={expandOne}
          collapseOne={collapseOne}
          collapseAll={collapseAll}
          expandAll={expandAll}
          childrenToggle={childrenToggle}
          childrenHiddenIDs={childrenHiddenIDs}
        />
      </Collapse>
    </>
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
      const references = [];
      if (s.parentSpanID) {
        references.push({ refType: 'CHILD_OF' as const, spanID: s.parentSpanID, traceID: s.traceID });
      }
      if (s.references) {
        references.push(...s.references.map((reference) => ({ refType: 'FOLLOWS_FROM' as const, ...reference })));
      }
      return {
        ...s,
        duration: s.duration * 1000,
        startTime: s.startTime * 1000,
        processID: s.spanID,
        flags: 0,
        references,
        logs: s.logs?.map((l) => ({ ...l, timestamp: l.timestamp * 1000 })) || [],
        dataFrameRowIndex: index,
      };
    }),
  };
}
