import React, { RefObject, useMemo, useState } from 'react';
import { Collapse } from '@grafana/ui';
import { DataFrame, SplitOpen, PanelData } from '@grafana/data';
import { TraceView } from './TraceView';
import { ExploreId } from 'app/types/explore';
import TracePageSearchBar from '@jaegertracing/jaeger-ui-components/src/TracePageHeader/TracePageSearchBar';
import { useSearch } from './useSearch';
import { transformDataFrames } from './utils/transform';
import { useSelector } from 'react-redux';
import { StoreState } from 'app/types';
import { TopOfViewRefType } from '@jaegertracing/jaeger-ui-components/src/TraceTimelineViewer/VirtualizedTraceView';

interface Props {
  dataFrames: DataFrame[];
  splitOpenFn: SplitOpen;
  exploreId: ExploreId;
  scrollElement?: Element;
  queryResponse: PanelData;
  topOfViewRef?: RefObject<HTMLDivElement>;
  topOfViewRefType?: TopOfViewRefType;
}
export function TraceViewContainer(props: Props) {
  // At this point we only show single trace
  const frame = props.dataFrames[0];
  const { dataFrames, splitOpenFn, exploreId, scrollElement, topOfViewRef, queryResponse } = props;
  const { topOfViewRefType } = props;
  const traceProp = useMemo(() => transformDataFrames(frame), [frame]);
  const { search, setSearch, spanFindMatches } = useSearch(traceProp?.spans);
  const [focusedSpanIdForSearch, setFocusedSpanIdForSearch] = useState('');
  const [searchBarSuffix, setSearchBarSuffix] = useState('');
  const datasource = useSelector(
    (state: StoreState) => state.explore[props.exploreId!]?.datasourceInstance ?? undefined
  );

  const setTraceSearch = (value: string) => {
    setFocusedSpanIdForSearch('');
    setSearchBarSuffix('');
    setSearch(value);
  };

  if (!traceProp) {
    return null;
  }

  return (
    <>
      <TracePageSearchBar
        nextResult={() => {
          const nextResults = nextResult(spanFindMatches, focusedSpanIdForSearch);
          setFocusedSpanIdForSearch(nextResults!['focusedSpanIdForSearch']);
          setSearchBarSuffix(nextResults!['searchBarSuffix']);
        }}
        prevResult={() => {
          const prevResults = prevResult(spanFindMatches, focusedSpanIdForSearch);
          setFocusedSpanIdForSearch(prevResults!['focusedSpanIdForSearch']);
          setSearchBarSuffix(prevResults!['searchBarSuffix']);
        }}
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
          traceProp={traceProp}
          spanFindMatches={spanFindMatches}
          search={search}
          focusedSpanIdForSearch={focusedSpanIdForSearch}
          queryResponse={queryResponse}
          datasource={datasource}
          topOfViewRef={topOfViewRef}
          topOfViewRefType={topOfViewRefType}
        />
      </Collapse>
    </>
  );
}

export const nextResult = (spanFindMatches: Set<string> | undefined, focusedSpanIdForSearch: string) => {
  const spanMatches = Array.from(spanFindMatches!);
  const prevMatchedIndex = spanMatches.indexOf(focusedSpanIdForSearch)
    ? spanMatches.indexOf(focusedSpanIdForSearch)
    : 0;

  // new query || at end, go to start
  if (prevMatchedIndex === -1 || prevMatchedIndex === spanMatches.length - 1) {
    return {
      focusedSpanIdForSearch: spanMatches[0],
      searchBarSuffix: getSearchBarSuffix(1, spanFindMatches),
    };
  }

  // get next
  return {
    focusedSpanIdForSearch: spanMatches[prevMatchedIndex + 1],
    searchBarSuffix: getSearchBarSuffix(prevMatchedIndex + 2, spanFindMatches),
  };
};

export const prevResult = (spanFindMatches: Set<string> | undefined, focusedSpanIdForSearch: string) => {
  const spanMatches = Array.from(spanFindMatches!);
  const prevMatchedIndex = spanMatches.indexOf(focusedSpanIdForSearch)
    ? spanMatches.indexOf(focusedSpanIdForSearch)
    : 0;

  // new query || at start, go to end
  if (prevMatchedIndex === -1 || prevMatchedIndex === 0) {
    return {
      focusedSpanIdForSearch: spanMatches[spanMatches.length - 1],
      searchBarSuffix: getSearchBarSuffix(spanMatches.length, spanFindMatches),
    };
  }

  // get prev
  return {
    focusedSpanIdForSearch: spanMatches[prevMatchedIndex - 1],
    searchBarSuffix: getSearchBarSuffix(prevMatchedIndex, spanFindMatches),
  };
};

export const getSearchBarSuffix = (index: number, spanFindMatches: Set<string> | undefined): string => {
  if (spanFindMatches?.size && spanFindMatches?.size > 0) {
    return index + ' of ' + spanFindMatches?.size;
  }
  return '';
};
