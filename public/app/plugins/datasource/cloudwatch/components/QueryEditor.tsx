import React, { useEffect, useState } from 'react';

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
  const [headerActions, setHeaderActions] = useState<JSX.Element>();

  useEffect(() => {
    setDataIsStale(false);
  }, [data]);

  const onChangeInternal = (query: CloudWatchQuery) => {
    setDataIsStale(true);
    onChange(query);
  };

  return (
    <>
      <QueryHeader {...props} element={headerActions} dataIsStale={dataIsStale} />

      {isCloudWatchMetricsQuery(query) && (
        <MetricsQueryEditor
          {...props}
          query={query}
          onRunQuery={() => {}}
          onChange={onChangeInternal}
          setHeaderItems={setHeaderActions}
        />
      )}
      {isCloudWatchLogsQuery(query) && (
        <LogsQueryEditor {...props} query={query} onChange={onChangeInternal} setHeaderItems={setHeaderActions} />
      )}
    </>
  );
};
