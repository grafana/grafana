import TracePageSearchBar from '@jaegertracing/jaeger-ui-components/src/TracePageHeader/TracePageSearchBar';
import { TopOfViewRefType } from '@jaegertracing/jaeger-ui-components/src/TraceTimelineViewer/VirtualizedTraceView';
import React, { RefObject, useMemo, useState } from 'react';

import { DataFrame, SplitOpen, PanelData } from '@grafana/data';
import { Collapse } from '@grafana/ui';
import { StoreState, useSelector } from 'app/types';
import { ExploreId } from 'app/types/explore';

import { TraceView } from './TraceView';
import { useSearch } from './useSearch';
import { transformDataFrames } from './utils/transform';
interface Props {
  dataFrames: DataFrame[];
  splitOpenFn: SplitOpen;
  exploreId: ExploreId;
  scrollElement?: Element;
  queryResponse: PanelData;
  topOfViewRef: RefObject<HTMLDivElement>;
}
export function TraceViewContainer(props: Props) {
  // At this point we only show single trace
  const frame = props.dataFrames[0];
  const { dataFrames, splitOpenFn, exploreId, scrollElement, topOfViewRef, queryResponse } = props;
  const traceProp = useMemo(() => transformDataFrames(frame), [frame]);
  const { search, setSearch, spanFindMatches } = useSearch(traceProp?.spans);
  const [focusedSpanIdForSearch, setFocusedSpanIdForSearch] = useState('');
  const [searchBarSuffix, setSearchBarSuffix] = useState('');
  const datasource = useSelector(
    (state: StoreState) => state.explore[props.exploreId!]?.datasourceInstance ?? undefined
  );

  if (!traceProp) {
    return null;
  }

  return (
    <>
      <TracePageSearchBar
        navigable={true}
        searchValue={search}
        setSearch={setSearch}
        spanFindMatches={spanFindMatches}
        searchBarSuffix={searchBarSuffix}
        setSearchBarSuffix={setSearchBarSuffix}
        focusedSpanIdForSearch={focusedSpanIdForSearch}
        setFocusedSpanIdForSearch={setFocusedSpanIdForSearch}
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
          topOfViewRefType={TopOfViewRefType.Explore}
        />
      </Collapse>
    </>
  );
}
