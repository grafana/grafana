// Libraries
import React, { memo } from 'react';

// Types
import { ExploreQueryFieldProps } from '@grafana/data';
import { LokiDatasource } from '../datasource';
import { LokiQuery, LokiOptions } from '../types';
import { LokiQueryField } from './LokiQueryField';
import { LokiOptionFields } from './LokiOptionFields';

type Props = ExploreQueryFieldProps<LokiDatasource, LokiQuery, LokiOptions>;

export function LokiExploreQueryEditor(props: Props) {
  const { range, query, data, datasource, history, onChange, onRunQuery } = props;
  const absoluteTimeRange = { from: range!.from!.valueOf(), to: range!.to!.valueOf() }; // Range here is never optional

  return (
    <LokiQueryField
      datasource={datasource}
      query={query}
      onChange={onChange}
      onBlur={() => {}}
      onRunQuery={onRunQuery}
      history={history}
      data={data}
      absoluteRange={absoluteTimeRange}
      ExtraFieldElement={
        <LokiOptionFields
          queryType={query.instant ? 'instant' : 'range'}
          lineLimitValue={query?.maxLines?.toString() || ''}
          query={query}
          onRunQuery={onRunQuery}
          onChange={onChange}
        />
      }
    />
  );
}

export default memo(LokiExploreQueryEditor);
