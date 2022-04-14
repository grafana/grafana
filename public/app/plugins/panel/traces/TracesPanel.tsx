import React, { useMemo, useState, createRef } from 'react';
import { PanelProps } from '@grafana/data';
import { TraceView } from 'app/features/explore/TraceView/TraceView';
import { css } from '@emotion/css';
import { transformDataFrames } from 'app/features/explore/TraceView/utils/transform';
import { getDataSourceSrv } from '@grafana/runtime';
import { useAsync } from 'react-use';
import TracePageSearchBar from '@jaegertracing/jaeger-ui-components/src/TracePageHeader/TracePageSearchBar';
import { useSearch } from 'app/features/explore/TraceView/useSearch';
import { nextResult, prevResult } from 'app/features/explore/TraceView/TraceViewContainer';
import { TopOfViewRefType } from '@jaegertracing/jaeger-ui-components/src/TraceTimelineViewer/VirtualizedTraceView';

const styles = {
  wrapper: css`
    height: 100%;
    overflow: scroll;
  `,
};

export const TracesPanel: React.FunctionComponent<PanelProps> = ({ data }) => {
  const topOfViewRef = createRef<HTMLDivElement>();
  const traceProp = useMemo(() => transformDataFrames(data.series[0]), [data.series]);
  const { search, setSearch, spanFindMatches } = useSearch(traceProp?.spans);
  const [focusedSpanIdForSearch, setFocusedSpanIdForSearch] = useState('');
  const [searchBarSuffix, setSearchBarSuffix] = useState('');
  const dataSource = useAsync(async () => {
    return await getDataSourceSrv().get(data.request?.targets[0].datasource?.uid);
  });
  const scrollElement = document.getElementsByClassName(styles.wrapper)[0];

  const setTraceSearch = (value: string) => {
    setFocusedSpanIdForSearch('');
    setSearchBarSuffix('');
    setSearch(value);
  };

  if (!data || !data.series.length || !traceProp) {
    return (
      <div className="panel-empty">
        <p>No data found in response</p>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div ref={topOfViewRef}></div>
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

      <TraceView
        dataFrames={data.series}
        scrollElement={scrollElement}
        traceProp={traceProp}
        spanFindMatches={spanFindMatches}
        search={search}
        focusedSpanIdForSearch={focusedSpanIdForSearch}
        queryResponse={data}
        datasource={dataSource.value}
        topOfViewRef={topOfViewRef}
        topOfViewRefType={TopOfViewRefType.Panel}
      />
    </div>
  );
};
