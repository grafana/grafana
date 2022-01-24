// Libraries
import React, { memo } from 'react';
// Types
import { LokiDirectionType, LokiQuery } from '../types';
import { LokiQueryField } from './LokiQueryField';
import { LokiOptionFields } from './LokiOptionFields';
import LokiDatasource from '../datasource';

interface Props {
  direction?: LokiDirectionType;
  expr: string;
  maxLines?: number;
  instant?: boolean;
  datasource: LokiDatasource;
  onChange: (query: LokiQuery) => void;
}

export const LokiAnnotationsQueryEditor = memo(function LokiAnnotationQueryEditor(props: Props) {
  const { direction, expr, maxLines, instant, datasource, onChange } = props;

  const queryWithRefId: LokiQuery = {
    refId: '',
    direction,
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
            queryDirection={queryWithRefId.direction ?? datasource.direction ?? 'BACKWARD'}
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
