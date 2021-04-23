// Libraries
import React, { memo } from 'react';

// Types
import { QueryEditorProps } from '@grafana/data';
import { InlineFormLabel } from '@grafana/ui';
import { LokiDatasource } from '../datasource';
import { LokiQuery, LokiOptions } from '../types';
import { LokiQueryField } from './LokiQueryField';
import { LokiOptionFields } from './LokiOptionFields';

type Props = QueryEditorProps<LokiDatasource, LokiQuery, LokiOptions>;

export function LokiQueryEditor(props: Props) {
  const { range, query, data, datasource, onChange, onRunQuery } = props;
  const absoluteTimeRange = { from: range!.from!.valueOf(), to: range!.to!.valueOf() }; // Range here is never optional

  const onLegendChange = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const nextQuery = { ...query, legendFormat: e.currentTarget.value };
    onChange(nextQuery);
  };

  const legendField = (
    <div className="gf-form-inline">
      <div className="gf-form">
        <InlineFormLabel
          width={6}
          tooltip="Controls the name of the time series, using name or pattern. For example
        {{hostname}} will be replaced with label value for the label hostname. The legend only applies to metric queries."
        >
          Legend
        </InlineFormLabel>
        <input
          type="text"
          className="gf-form-input"
          placeholder="legend format"
          value={query.legendFormat || ''}
          onChange={onLegendChange}
          onBlur={onRunQuery}
        />
      </div>
    </div>
  );

  return (
    <LokiQueryField
      datasource={datasource}
      query={query}
      onChange={onChange}
      onRunQuery={onRunQuery}
      onBlur={onRunQuery}
      history={[]}
      data={data}
      absoluteRange={absoluteTimeRange}
      ExtraFieldElement={
        <>
          <LokiOptionFields
            queryType={query.instant ? 'instant' : 'range'}
            lineLimitValue={query?.maxLines?.toString() || ''}
            query={query}
            onRunQuery={onRunQuery}
            onChange={onChange}
            runOnBlur={true}
          />
          {legendField}
        </>
      }
    />
  );
}

export default memo(LokiQueryEditor);
