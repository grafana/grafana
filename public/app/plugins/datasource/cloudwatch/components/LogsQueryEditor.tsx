// Libraries
import React, { memo } from 'react';

// Types
import { AbsoluteTimeRange, QueryEditorProps } from '@grafana/data';
import { CloudWatchDatasource } from '../datasource';
import { CloudWatchLogsQuery, CloudWatchQuery } from '../types';
import { CloudWatchLogsQueryField } from './LogsQueryField';

type Props = QueryEditorProps<CloudWatchDatasource, CloudWatchQuery>;

export const CloudWatchLogsQueryEditor = memo(function CloudWatchLogsQueryEditor(props: Props) {
  const { query, data, datasource, onChange, onRunQuery } = props;

  let absolute: AbsoluteTimeRange;
  if (data?.request?.range?.from) {
    const { range } = data.request;
    absolute = {
      from: range.from.valueOf(),
      to: range.to.valueOf(),
    };
  } else {
    absolute = {
      from: Date.now() - 10000,
      to: Date.now(),
    };
  }

  return (
    <CloudWatchLogsQueryField
      datasource={datasource}
      query={query}
      onChange={(val: CloudWatchLogsQuery) => onChange({ ...val, type: 'Logs' })}
      onRunQuery={onRunQuery}
      history={[]}
      data={data}
      absoluteRange={absolute}
    />
  );
});

export default CloudWatchLogsQueryEditor;
