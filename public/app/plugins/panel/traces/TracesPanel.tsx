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
  const { search, setSearch, searchMatches } = useSearch(traceProp?.spans);
  const [focusedSearchMatch, setFocusedSearchMatch] = useState('');
  const dataSource = useAsync(async () => {
    return await getDataSourceSrv().get(data.request?.targets[0].datasource?.uid);
  });
  const scrollElement = document.getElementsByClassName(styles.wrapper)[0];
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
      {data.series[0]?.meta?.preferredVisualisationType === 'trace' && !config.featureToggles.newTraceView ? (
        <TracePageSearchBar
          // searchValue={search}
          // setSearch={setSearch}
          searchMatches={searchMatches}
          focusedSearchMatch={focusedSearchMatch}
          setFocusedSearchMatch={setFocusedSearchMatch}
          datasourceType={datasourceType}
        />
      ) : null}

      <TraceView
        dataFrames={data.series}
        scrollElement={scrollElement}
        traceProp={traceProp}
        searchMatches={searchMatches}
        search={search}
        setSearch={setSearch}
        focusedSearchMatch={focusedSearchMatch}
        setFocusedSearchMatch={setFocusedSearchMatch}
        queryResponse={data}
        datasource={dataSource.value}
        topOfViewRef={topOfViewRef}
        topOfViewRefType={TopOfViewRefType.Panel}
      />
    </div>
  );
};
