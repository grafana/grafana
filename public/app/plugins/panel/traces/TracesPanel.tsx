import { css } from '@emotion/css';
import React, { useMemo, useState, createRef } from 'react';
import { useAsync } from 'react-use';

import { PanelProps } from '@grafana/data';
import { config, getDataSourceSrv } from '@grafana/runtime';
import { TraceView } from 'app/features/explore/TraceView/TraceView';
import TracePageSearchBar from 'app/features/explore/TraceView/components/TracePageHeader/TracePageSearchBar';
import { TopOfViewRefType } from 'app/features/explore/TraceView/components/TraceTimelineViewer/VirtualizedTraceView';
import { useSearch } from 'app/features/explore/TraceView/useSearch';
import { transformDataFrames } from 'app/features/explore/TraceView/utils/transform';

const styles = {
  wrapper: css`
    height: 100%;
    overflow: scroll;
  `,
};

export const TracesPanel = ({ data }: PanelProps) => {
  const topOfViewRef = createRef<HTMLDivElement>();
  const traceProp = useMemo(() => transformDataFrames(data.series[0]), [data.series]);
  const { search, setSearch, spanFindMatches } = useSearch(traceProp?.spans);
  const [focusedSpanIdForSearch, setFocusedSpanIdForSearch] = useState('');
  const [searchBarSuffix, setSearchBarSuffix] = useState('');
  const dataSource = useAsync(async () => {
    return await getDataSourceSrv().get(data.request?.targets[0].datasource?.uid);
  });
  const datasourceType = dataSource && dataSource.value ? dataSource.value.type : 'unknown';

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
      {!config.featureToggles.newTraceView ? (
        <TracePageSearchBar
          navigable={true}
          searchValue={search}
          setSearch={setSearch}
          spanFindMatches={spanFindMatches}
          searchBarSuffix={searchBarSuffix}
          setSearchBarSuffix={setSearchBarSuffix}
          focusedSpanIdForSearch={focusedSpanIdForSearch}
          setFocusedSpanIdForSearch={setFocusedSpanIdForSearch}
          datasourceType={datasourceType}
        />
      ) : null}

      <TraceView
        dataFrames={data.series}
        scrollElementClass={styles.wrapper}
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
