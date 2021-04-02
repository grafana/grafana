// Libraries
import React, { memo } from 'react';

// Types
import { LokiQuery } from '../types';
import { LokiQueryFieldForm } from './LokiQueryFieldForm';
import LokiDatasource from '../datasource';

interface Props {
  expr: string;
  maxLines?: number;
  instant?: boolean;
  datasource: LokiDatasource;
  onChange: (query: LokiQuery) => void;
}

export const LokiAnnotationsQueryEditor = memo(function LokiAnnotationQueryEditor(props: Props) {
  const { expr, maxLines, instant, datasource, onChange } = props;

  // Timerange to get existing labels from. Hard coding like this seems to be good enough right now.
  const absolute = {
    from: Date.now() - 10000,
    to: Date.now(),
  };

  const queryWithRefId: LokiQuery = {
    refId: '',
    expr,
    maxLines,
    instant,
  };
  return (
    <div className="gf-form-group">
      <LokiQueryFieldForm
        datasource={datasource}
        query={queryWithRefId}
        onChange={onChange}
        onRunQuery={() => {}}
        history={[]}
        absoluteRange={absolute}
      />
    </div>
  );
});
