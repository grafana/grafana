// Libraries
import React, { memo } from 'react';

// Types
import { LokiDatasource } from '../datasource';
import { LokiQuery } from '../types';

import { LokiOptionFields } from './LokiOptionFields';
import { LokiQueryField } from './LokiQueryField';

interface Props {
  expr: string;
  maxLines?: number;
  instant?: boolean;
  datasource: LokiDatasource;
  onChange: (query: LokiQuery) => void;
}

export const LokiAnnotationsQueryEditor = memo(function LokiAnnotationQueryEditor(props: Props) {
  const { expr, maxLines, instant, datasource, onChange } = props;

  const queryWithRefId: LokiQuery = {
    refId: '',
    expr,
    maxLines,
    instant,
  };
  return (
    <div className="gf-form-group">
      <LokiQueryField
        datasource={datasource}
        query={queryWithRefId}
        onChange={onChange}
        onRunQuery={() => {}}
        onBlur={() => {}}
        history={[]}
        ExtraFieldElement={
          <LokiOptionFields
            lineLimitValue={queryWithRefId?.maxLines?.toString() || ''}
            resolution={queryWithRefId.resolution || 1}
            query={queryWithRefId}
            onRunQuery={() => {}}
            onChange={onChange}
          />
        }
      />
    </div>
  );
});
