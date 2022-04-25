import TracePageSearchBar from '@jaegertracing/jaeger-ui-components/src/TracePageHeader/TracePageSearchBar';
import React, { RefObject, useMemo, useState } from 'react';

import { DataFrame, SplitOpen, PanelData } from '@grafana/data';
import { Collapse } from '@grafana/ui';
import { ExploreId } from 'app/types/explore';

import { TraceView } from './TraceView';
import { useChildrenState } from './useChildrenState';
import { useSearch } from './useSearch';
import { transformDataFrames } from './utils/transform';
interface Props {
  dataFrames: DataFrame[];
  splitOpenFn: SplitOpen;
  exploreId: ExploreId;
  scrollElement?: Element;
  topOfExploreViewRef?: RefObject<HTMLDivElement>;
  queryResponse: PanelData;
}
export function TraceViewContainer(props: Props) {
  // At this point we only show single trace
  const frame = props.dataFrames[0];

  const { dataFrames, splitOpenFn, exploreId, scrollElement, topOfExploreViewRef, queryResponse } = props;
  const traceProp = useMemo(() => transformDataFrames(frame), [frame]);
  const { search, setSearch, spanFindMatches } = useSearch(traceProp?.spans);
  const { expandOne, collapseOne, childrenToggle, collapseAll, childrenHiddenIDs, expandAll } = useChildrenState();

  const [focusedSpanIdForSearch, setFocusedSpanIdForSearch] = useState('');
  const [searchBarSuffix, setSearchBarSuffix] = useState('');

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
          queryResponse={queryResponse}
        />
      </Collapse>
    </>
  );
}
