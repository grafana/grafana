import TracePageSearchBar from '@jaegertracing/jaeger-ui-components/src/TracePageHeader/TracePageSearchBar';
import { TopOfViewRefType } from '@jaegertracing/jaeger-ui-components/src/TraceTimelineViewer/VirtualizedTraceView';
import React, { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';

import { ExplorePanelProps } from '@grafana/data';
import { Collapse } from '@grafana/ui';
import { TraceView } from 'app/features/explore/TraceView/TraceView';
import { useSearch } from 'app/features/explore/TraceView/useSearch';
import { transformDataFrames } from 'app/features/explore/TraceView/utils/transform';
import { useScrollElements } from 'app/features/explore/utils/panelHooks';
import { StoreState } from 'app/types';

export function TraceViewExplorePanel(props: ExplorePanelProps) {
  // This is used only in explore context so this should be defined
  const { scrollElement, topOfViewRef } = useScrollElements()!;

  // At this point we only show single trace
  const { splitOpen, exploreId, data } = props;
  const frame = data[0];
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
          dataFrames={data}
          splitOpenFn={splitOpen}
          scrollElement={scrollElement}
          traceProp={traceProp}
          spanFindMatches={spanFindMatches}
          search={search}
          focusedSpanIdForSearch={focusedSpanIdForSearch}
          datasource={datasource}
          topOfViewRef={topOfViewRef}
          topOfViewRefType={TopOfViewRefType.Explore}
        />
      </Collapse>
    </>
  );
}
