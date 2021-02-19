// Libraries
import React, { memo } from 'react';

// Types
import { AbsoluteTimeRange, QueryEditorProps } from '@grafana/data';
import { LokiDatasource } from '../datasource';
import { LokiQuery } from '../types';
import { LokiQueryField } from './LokiQueryField';

type Props = QueryEditorProps<LokiDatasource, LokiQuery>;

export const LokiQueryEditor = memo(function LokiQueryEditor(props: Props) {
  const { query, data, datasource, onChange, onRunQuery } = props;

  let absolute: AbsoluteTimeRange;
  if (data && data.request) {
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
    <div>
      <LokiQueryField
        datasource={datasource}
        query={query}
        onChange={onChange}
        onRunQuery={onRunQuery}
        history={[]}
        data={data}
        absoluteRange={absolute}
      />
    </div>
  );
});

export default LokiQueryEditor;
