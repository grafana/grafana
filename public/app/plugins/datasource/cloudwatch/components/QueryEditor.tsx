import React, { useCallback, useEffect, useState } from 'react';

import { QueryEditorProps } from '@grafana/data';

import { CloudWatchDatasource } from '../datasource';
import { isCloudWatchLogsQuery, isCloudWatchMetricsQuery } from '../guards';
import { CloudWatchJsonData, CloudWatchQuery } from '../types';

import LogsQueryEditor from './LogsQueryEditor';
import { MetricsQueryEditor } from './MetricsQueryEditor/MetricsQueryEditor';
import QueryHeader from './QueryHeader';

export type Props = QueryEditorProps<CloudWatchDatasource, CloudWatchQuery, CloudWatchJsonData>;

export const QueryEditor = (props: Props) => {
  const { query, onChange, data } = props;
  const [dataIsStale, setDataIsStale] = useState(false);
  const [headerElementLeft, setHeaderElementLeft] = useState<JSX.Element>();
  const [headerElementRight, setHeaderElementRight] = useState<JSX.Element>();

  useEffect(() => {
    setDataIsStale(false);
  }, [data]);

  const onChangeInternal = useCallback(
    (query: CloudWatchQuery) => {
      setDataIsStale(true);
      onChange(query);
    },
    [onChange]
  );

  return (
    <>
      <QueryHeader
        {...props}
        leftHeaderElement={headerElementLeft}
        rightHeaderElement={headerElementRight}
        dataIsStale={dataIsStale}
      />

      {isCloudWatchMetricsQuery(query) && (
        <MetricsQueryEditor
          {...props}
          query={query}
          onRunQuery={() => {}}
          onChange={onChangeInternal}
          headerElementLeft={setHeaderElementLeft}
          headerElementRight={setHeaderElementRight}
        />
      )}
      {isCloudWatchLogsQuery(query) && (
        <LogsQueryEditor
          {...props}
          query={query}
          onChange={onChangeInternal}
          headerElementLeft={setHeaderElementLeft}
          headerElementRight={setHeaderElementRight}
        />
      )}
    </>
  );
};
